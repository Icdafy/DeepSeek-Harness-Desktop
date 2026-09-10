"use strict";
const fs = require("node:fs");
const path = require("node:path");

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
  await until('document.body.innerText.includes("稍后配置")', "optional model setup");
  await clickText("稍后配置");
  await create();
  await until('document.querySelectorAll(".dsh-desktop-chat-item").length === 1', "create blank chat");
  const [deletedId] = await ids();
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
}

module.exports = { verifyChatUi };
