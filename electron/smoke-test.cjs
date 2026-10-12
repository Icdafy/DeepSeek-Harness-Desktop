"use strict";
const fs = require("node:fs");
const path = require("node:path");

function prepareWorkspaceFixtures(home) {
  const workspacePath = path.join(home, "smoke-workspaces", "kept-project");
  const missingPath = path.join(home, "smoke-workspaces", "Desktop", "人形机器人研究");
  fs.mkdirSync(workspacePath, { recursive: true });
  fs.writeFileSync(path.join(workspacePath, "report.md"), "keep workspace files");
  fs.mkdirSync(path.join(home, "storages"), { recursive: true });
  const record = (directory, title, createdAt) => ({ path: directory, title, sessionIds: [], createdAt, updatedAt: createdAt });
  fs.writeFileSync(path.join(home, "storages", "workspace.json"), JSON.stringify({
    unit: { name: "workspace", version: 2 },
    global: { initialized: true, workspaceIds: ["smoke-missing", "smoke-workspace"], archivedSessionIds: [], pinnedSessionIds: [] },
    tables: { workspaces: {
      "smoke-missing": record(missingPath, "人形机器人研究", "2026-10-12T00:00:00.000Z"),
      "smoke-workspace": record(fs.realpathSync(workspacePath), "kept-project", "2026-10-11T00:00:00.000Z"),
    } },
  }));
}

async function verifyChatUi(window, home, log) {
  const js = source => window.webContents.executeJavaScript(source);
  async function until(source, label, timeout = 30_000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try { if (await js(source)) return; } catch { /* navigation replaces the context */ }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    const text = await js('document.body.innerText').catch(() => "no renderer");
    throw new Error(`Smoke ${label}: ${text.slice(0, 2500)}`);
  }
  const clickText = text => js(`Array.from(document.querySelectorAll('button,[role="menuitem"]')).find(el => el.textContent.trim() === ${JSON.stringify(text)})?.click()`);
  const create = () => js('document.querySelector(".dsh-desktop-chat-icon-button").click()');
  const ids = () => js('JSON.parse(localStorage.getItem("dsh.desktop-chat.sessions.v1") || "[]")');
  // A fresh profile displays the upstream developer-preview notice.
  await until('document.body.innerText.includes("继续")', "preview notice");
  await clickText("继续");
  await until('document.body.innerText.includes("稍后配置") || !document.body.innerText.includes("预览版说明")', "preview dismissed");
  if (await js('document.body.innerText.includes("稍后配置")')) await clickText("稍后配置");
  await until('document.body.innerText.includes("工作目录不存在或不可访问")', "missing workspace startup guard");
  const missingPath = path.join(home, "smoke-workspaces", "Desktop", "人形机器人研究");
  if (fs.existsSync(missingPath)) throw new Error("Startup recreated the removed workspace");
  log("info", "Smoke: startup refuses to recreate a removed workspace");
  await create();
  await until('document.querySelectorAll(".dsh-desktop-chat-item").length === 1', "create blank chat");
  const [deletedId] = await ids();
  await until('document.querySelector(".dsh-desktop-chat-item[data-current=true]") && document.querySelector("[contenteditable=true]")', "open chat and composer");
  if (await js('document.body.innerText.includes("稍后配置")')) await clickText("稍后配置");
  await until('!!document.querySelector(".dsh-desktop-chat-row-menu")', "blank chat menu");
  await js('document.querySelector(".dsh-desktop-chat-row-menu").click()');
  await clickText("重命名");
  await until('!!document.querySelector(".dsh-desktop-chat-rename-input")', "rename dialog");
  await js(`(() => {
    const input = document.querySelector('.dsh-desktop-chat-rename-input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '桌面发布验证');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await clickText("保存");
  await until('document.querySelector(".dsh-desktop-chat-item-title")?.textContent === "桌面发布验证"', "durable rename");
  log("info", "Smoke: blank-chat menu and durable rename passed");
  await create();
  await until('document.querySelectorAll(".dsh-desktop-chat-item").length === 2', "second independent chat");
  const [retainedId] = await ids();
  await js('Array.from(document.querySelectorAll(".dsh-desktop-chat-item")).find(el => el.textContent.includes("桌面发布验证")).click()');
  if (process.env.DSH_DESKTOP_SMOKE_SCREENSHOT) {
    fs.writeFileSync(process.env.DSH_DESKTOP_SMOKE_SCREENSHOT, (await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG());
  }
  await js('Array.from(document.querySelectorAll(".dsh-desktop-chat-item")).find(el => el.textContent.includes("桌面发布验证")).querySelector("button").click()');
  await clickText("完全删除");
  await until('document.body.textContent.includes("确定完全删除")', "permanent deletion confirmation");
  await clickText("完全删除");
  await until(`document.querySelectorAll('.dsh-desktop-chat-item').length === 1 && !JSON.parse(localStorage.getItem('dsh.desktop-chat.sessions.v1') || '[]').includes(${JSON.stringify(deletedId)})`, "delete and reconnect", 60_000);
  const remaining = await ids();
  if (!remaining.includes(retainedId)) throw new Error("Deletion lost another chat");
  const root = path.join(home, "sessions");
  for (const project of fs.readdirSync(root)) {
    if (fs.existsSync(path.join(root, project, deletedId))) throw new Error("Deleted session still exists on disk");
  }
  await window.webContents.reload();
  await until('document.querySelectorAll(".dsh-desktop-chat-item").length === 1', "deletion survives reload");
  log("info", "Smoke: permanent deletion, retained sibling and reload passed");
  if (await js('document.body.innerText.includes("稍后配置")')) await clickText("稍后配置");
  await js('document.querySelector(".dsh-desktop-chat-item").click()');
  await until('!!document.querySelector(".dsh-desktop-chat-item[data-current=true]")', "reopen retained chat");
  await js('document.querySelector(".dsh-desktop-chat-row-menu").click()');
  await clickText("分叉对话");
  // Upstream rejects a fork until a session has a completed model turn.
  await until('document.querySelector(".dsh-desktop-chat-error")?.textContent.includes("session/fork-unavailable")', "empty-session fork guard");
  if ((await ids()).length !== 1) throw new Error("Rejected fork changed the session list");
  await create();
  await until('document.querySelectorAll(".dsh-desktop-chat-item").length === 2 && document.querySelector(".dsh-desktop-chat-item[data-current=true]") === document.querySelector(".dsh-desktop-chat-item")', "open chat to archive");
  const [archivedId] = await ids();
  await js('document.querySelector(".dsh-desktop-chat-item[data-current=true] .dsh-desktop-chat-row-menu").click()');
  await clickText("归档对话");
  await until(`document.querySelectorAll('.dsh-desktop-chat-item').length === 1 && !JSON.parse(localStorage.getItem('dsh.desktop-chat.sessions.v1') || '[]').includes(${JSON.stringify(archivedId)})`, "archive chat");
  if (!(await ids()).includes(retainedId)) throw new Error("Archiving lost the original chat");
  log("info", "Smoke: empty-session fork guard, navigation and archive passed");
  // Exercise the real workspace slot, including a current blank Session row.
  const currentWorkspaceId = () => js(`document.querySelector('[data-row-key^="session:"][aria-selected=true]')?.getAttribute('data-row-key').slice(8)`);
  const createWorkspaceChat = () => js('Array.from(document.querySelectorAll("button[aria-label]")).find(el => /kept-project/.test(el.getAttribute("aria-label")) && /新建会话/.test(el.getAttribute("aria-label")))?.click()');
  await createWorkspaceChat();
  await until(`!!document.querySelector('[data-row-key^="session:"][aria-selected=true]')`, "create workspace chat");
  const keptWorkspaceId = await currentWorkspaceId();
  await createWorkspaceChat();
  await until(`document.querySelector('[data-row-key^="session:"][aria-selected=true]')?.getAttribute('data-row-key') !== 'session:${keptWorkspaceId}'`, "second workspace chat");
  const deletedWorkspaceId = await currentWorkspaceId();
  if (!deletedWorkspaceId) throw new Error("No selected workspace Session");
  await js(`document.querySelector('[data-row-key^="session:"][aria-selected=true] button[aria-label^="会话"]').click()`);
  await clickText("完全删除");
  await until('document.body.textContent.includes("确定完全删除")', "workspace deletion confirmation");
  await clickText("取消");
  await until('!document.body.textContent.includes("确定完全删除")', "cancel workspace deletion");
  await js(`document.querySelector('[data-row-key="session:${deletedWorkspaceId}"] button[aria-label^="会话"]').click()`);
  await clickText("完全删除");
  await until('document.body.textContent.includes("确定完全删除")', "reopen workspace deletion confirmation");
  await clickText("完全删除");
  await until(`!document.querySelector('[data-row-key="session:${deletedWorkspaceId}"]') && !!document.querySelector('.dsh-desktop-chat-title') && !document.body.textContent.includes('确定完全删除')`, "workspace delete and reconnect", 60_000);
  const stored = JSON.parse(fs.readFileSync(path.join(home, "storages", "workspace.json"), "utf8"));
  const members = stored.tables.workspaces["smoke-workspace"].sessionIds;
  if (members.includes(deletedWorkspaceId) || !members.includes(keptWorkspaceId)) throw new Error("Workspace deletion corrupted membership");
  let retainedLog = false;
  for (const project of fs.readdirSync(root)) {
    if (fs.existsSync(path.join(root, project, deletedWorkspaceId))) throw new Error("Workspace Session still exists on disk");
    retainedLog ||= fs.existsSync(path.join(root, project, keptWorkspaceId));
  }
  if (!retainedLog) throw new Error("Deletion lost the sibling workspace Session");
  if (fs.existsSync(path.join(home, "storages", "session_projcache", "sessions", `${deletedWorkspaceId}.json`))) throw new Error("Deleted projection cache survived");
  if (fs.readFileSync(path.join(home, "smoke-workspaces", "kept-project", "report.md"), "utf8") !== "keep workspace files") throw new Error("Deletion changed workspace files");
  await window.webContents.reload();
  await until(`!!document.querySelector('.dsh-desktop-chat-title') && !!document.querySelector('[data-row-key="session:${keptWorkspaceId}"]')`, "workspace deletion survives reload");
  if (fs.existsSync(missingPath)) throw new Error("Reload recreated the removed workspace");
  log("info", "Smoke: workspace blank-chat deletion, cancellation, sibling/files/cache preservation and reload passed");
  if (await js('document.body.innerText.includes("稍后配置")')) await clickText("稍后配置");
  await clickText("设置");
  await until('document.body.innerText.includes("通用设置")', "settings dialog");
  await clickText("通用设置");
  await until('!!document.querySelector(".dsh-desktop-update-row")', "desktop updater settings");
  await clickText("内置插件");
  await until('document.body.innerText.includes("桌面插件")', "desktop plugins tab");
  await clickText("桌面插件");
  await until('document.body.innerText.includes("玻璃主题") && !!document.querySelector(".dsh-desktop-chat-card")', "Aqua and chat settings");
  await js(`Array.from(document.querySelectorAll('li')).find(el => el.textContent.includes('玻璃主题'))?.querySelector('button[aria-pressed]')?.click()`);
  await until('!document.documentElement.hasAttribute("data-dsh-aqua")', "disable Aqua");
  await js(`Array.from(document.querySelectorAll('li')).find(el => el.textContent.includes('玻璃主题'))?.querySelector('button[aria-pressed]')?.click()`);
  await until('document.documentElement.hasAttribute("data-dsh-aqua")', "enable Aqua");
  log("info", "Smoke: updater, desktop plugin settings and Aqua toggles passed");
}

module.exports = { prepareWorkspaceFixtures, verifyChatUi };
