"use strict";

const fs = require("node:fs");
const path = require("node:path");

function validateSessionId(id) {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new Error("无效的对话编号");
  return id;
}

function assertChild(candidate, parent) {
  const absolute = path.resolve(candidate);
  const relative = path.relative(path.resolve(parent), absolute);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    throw new Error("拒绝操作会话数据目录之外的路径");
  }
  // Reject junctions/symlinks at every existing level, including the root.
  let current = absolute;
  while (true) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error("会话数据路径不能包含符号链接");
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
  return absolute;
}

function pruneReferences(value, id) {
  if (Array.isArray(value)) return value.filter(item => item !== id).map(item => pruneReferences(item, id));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== id).map(([key, item]) => [key, pruneReferences(item, id)]));
}

// Called only after the Harness process exits. No transcript parsing or workspace
// file paths are trusted for deletion; identity selects one directory level.
function deleteSessionData({ home, root, sessionId, queryPath }) {
  validateSessionId(sessionId);
  const sessionRoot = assertChild(root, home);
  const targets = [];
  if (fs.existsSync(sessionRoot)) {
    for (const project of fs.readdirSync(sessionRoot, { withFileTypes: true })) {
      if (project.isSymbolicLink()) throw new Error("会话根目录包含符号链接");
      if (!project.isDirectory()) continue;
      const target = assertChild(path.join(sessionRoot, project.name, sessionId), sessionRoot);
      if (fs.existsSync(target)) {
        if (!fs.lstatSync(target).isDirectory()) throw new Error("会话路径不是目录");
        targets.push(target);
      }
    }
  }
  const workspace = assertChild(path.join(home, "storages", "workspace.json"), home);
  const workspaceValue = fs.existsSync(workspace) ? JSON.parse(fs.readFileSync(workspace, "utf8")) : undefined;
  const caches = [assertChild(path.join(home, "storages", "session_projcache.json"), home)];
  if (queryPath && queryPath !== ":memory:") {
    for (const suffix of ["", "-wal", "-shm"]) caches.push(assertChild(queryPath + suffix, home));
  }
  // Validate all paths and parse metadata before making any irreversible changes.
  for (const target of targets) fs.rmSync(target, { recursive: true, force: true });
  for (const cache of caches) fs.rmSync(cache, { force: true });
  if (workspaceValue !== undefined) fs.writeFileSync(workspace, JSON.stringify(pruneReferences(workspaceValue, sessionId), null, 2) + "\n");
  return { deletedDirectories: targets.length };
}

module.exports = { validateSessionId, deleteSessionData };
