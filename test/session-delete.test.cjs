"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { deleteSessionData, validateSessionId } = require("../electron/session-delete.cjs");

function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-delete-test-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const root = path.join(home, "sessions");
  const write = (relative, text = "private transcript") => {
    const file = path.join(home, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    return file;
  };
  return { home, root, write };
}

test("permanent deletion removes all log generations and caches, retaining other sessions and workspace files", t => {
  const f = fixture(t);
  const v2 = f.write("sessions/project/chat-1/session.v2.jsonl");
  const v3 = f.write("sessions/project/chat-1/session.v3.jsonl");
  const v4 = f.write("sessions/project/chat-1/session.v4.jsonl.zstd");
  const sibling = f.write("sessions/project/chat-2/session.v3.jsonl", "keep");
  const workspaceFile = f.write("project/report.md", "keep");
  const cache = f.write("storages/session_projcache.json", '{"chat-1":{"text":"secret"}}');
  const recordCache = f.write("storages/session_projcache/sessions/chat-1.json");
  const siblingCache = f.write("storages/session_projcache/sessions/chat-2.json", "keep");
  const workspace = f.write("storages/workspace.json", JSON.stringify({ sessions: ["chat-1", "chat-2"], titles: { "chat-1": "secret", "chat-2": "keep" } }));
  const result = deleteSessionData({ ...f, sessionId: "chat-1" });
  assert.equal(result.deletedDirectories, 1);
  for (const file of [v2, v3, v4, cache, recordCache]) assert.equal(fs.existsSync(file), false);
  for (const file of [sibling, workspaceFile, siblingCache]) assert.equal(fs.readFileSync(file, "utf8"), "keep");
  assert.deepEqual(JSON.parse(fs.readFileSync(workspace, "utf8")), { sessions: ["chat-2"], titles: { "chat-2": "keep" } });
});

test("blank sessions without a materialized log can be deleted", t => {
  const f = fixture(t);
  assert.equal(deleteSessionData({ ...f, sessionId: "blank-1" }).deletedDirectories, 0);
});

test("clears workspace membership, pin/archive references and SQLite sidecars", t => {
  const f = fixture(t);
  f.write("sessions/project/chat-1/session.v4.jsonl.zstd");
  const queryPath = f.write("storages/session-query.sqlite");
  const sidecars = [f.write("storages/session-query.sqlite-wal"), f.write("storages/session-query.sqlite-shm")];
  const workspace = f.write("storages/workspace.json", JSON.stringify({
    unit: { name: "workspace", version: 2 },
    global: { initialized: true, workspaceIds: ["project"], pinnedSessionIds: ["chat-1"], archivedSessionIds: ["chat-1"] },
    tables: { workspaces: { project: { path: "C:\\project", title: "keep", sessionIds: ["chat-1", "chat-2"] } } },
  }));
  deleteSessionData({ ...f, sessionId: "chat-1", queryPath });
  for (const file of [queryPath, ...sidecars]) assert.equal(fs.existsSync(file), false);
  const stored = JSON.parse(fs.readFileSync(workspace, "utf8"));
  assert.deepEqual(stored.tables.workspaces.project.sessionIds, ["chat-2"]);
  assert.equal(stored.tables.workspaces.project.path, "C:\\project");
  assert.deepEqual(stored.global.workspaceIds, ["project"]);
  assert.deepEqual(stored.global.pinnedSessionIds, []);
  assert.deepEqual(stored.global.archivedSessionIds, []);
});

test("external query paths cannot cause partial deletion", t => {
  const f = fixture(t);
  const victim = f.write("sessions/project/chat-1/session.v4.jsonl.zstd");
  assert.throws(() => deleteSessionData({ ...f, sessionId: "chat-1", queryPath: path.join(os.tmpdir(), "external.sqlite") }));
  assert.equal(fs.existsSync(victim), true);
});

test("rejects traversal, external roots, and junctions before deleting anything", t => {
  const f = fixture(t);
  const victim = f.write("sessions/project/chat-1/session.v3.jsonl");
  for (const id of ["../chat-1", ".", "..", "C:\\data", "", null]) assert.throws(() => validateSessionId(id));
  assert.throws(() => deleteSessionData({ ...f, root: f.home, sessionId: "chat-1" }));
  assert.throws(() => deleteSessionData({ ...f, root: os.tmpdir(), sessionId: "chat-1" }));
  const outside = path.join(f.home, "outside");
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(f.root, "junction"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => deleteSessionData({ ...f, sessionId: "chat-1" }), /符号链接/);
  assert.equal(fs.existsSync(victim), true);
});

test("unreadable registry JSON leaves the target session intact", t => {
  const f = fixture(t);
  const victim = f.write("sessions/project/chat-1/session.v3.jsonl");
  f.write("storages/workspace.json", "{");
  assert.throws(() => deleteSessionData({ ...f, sessionId: "chat-1" }));
  assert.equal(fs.existsSync(victim), true);
});
