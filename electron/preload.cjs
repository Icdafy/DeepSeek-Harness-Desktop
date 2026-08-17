"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("deepseekHarnessDesktop", Object.freeze({
  updates: Object.freeze({
    getState: () => ipcRenderer.invoke("desktop-updates:get-state"),
    setEnabled: (enabled) => ipcRenderer.invoke("desktop-updates:set-enabled", enabled === true),
    checkNow: () => ipcRenderer.invoke("desktop-updates:check-now"),
    onState: (listener) => {
      const handler = (_event, state) => listener(state);
      ipcRenderer.on("desktop-updates:state", handler);
      return () => ipcRenderer.removeListener("desktop-updates:state", handler);
    },
  }),
}));

function installTitlebar() {
  if (document.getElementById("dsh-desktop-titlebar")) return;
  const style = document.createElement("style");
  style.textContent = `
    :root { --dsh-desktop-titlebar-height: 40px; }
    html, body { box-sizing: border-box !important; height: 100% !important; }
    body { padding-top: var(--dsh-desktop-titlebar-height) !important; }
    #root { height: calc(100vh - var(--dsh-desktop-titlebar-height)) !important; }
    #dsh-desktop-titlebar {
      -webkit-app-region: drag;
      box-sizing: border-box;
      position: fixed;
      z-index: 2147483647;
      top: 0;
      right: 0;
      left: 0;
      display: flex;
      align-items: center;
      height: var(--dsh-desktop-titlebar-height);
      padding: 0 148px 0 12px;
      color: var(--dsw-alias-label-primary, #171717);
      background: var(--dsw-alias-bg-layer-1, #f7f7f8);
      border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, .12));
      font-family: Inter, "Segoe UI", sans-serif;
      user-select: none;
    }
    #dsh-desktop-titlebar img { width: 24px; height: 24px; margin-right: 8px; border-radius: 5px; }
    #dsh-desktop-titlebar span { overflow: hidden; font-size: 13px; font-weight: 500; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
  `;
  document.head.appendChild(style);

  const titlebar = document.createElement("div");
  titlebar.id = "dsh-desktop-titlebar";
  const icon = document.createElement("img");
  icon.alt = "";
  const name = document.createElement("span");
  name.textContent = "DeepSeek Harness";
  titlebar.append(icon, name);
  document.body.prepend(titlebar);

  ipcRenderer.invoke("desktop:get-window-metadata").then((metadata) => {
    name.textContent = metadata.appName;
    icon.src = metadata.iconDataUrl;
  });

  let colorTimer = null;
  const syncColors = () => {
    clearTimeout(colorTimer);
    colorTimer = setTimeout(() => {
      const computed = getComputedStyle(titlebar);
      ipcRenderer.send("desktop:titlebar-colors", {
        background: computed.backgroundColor,
        foreground: computed.color,
      });
    }, 50);
  };
  new MutationObserver(syncColors).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "style"],
  });
  new MutationObserver(syncColors).observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "style"],
  });
  globalThis.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", syncColors);
  syncColors();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installTitlebar, { once: true });
} else {
  installTitlebar();
}
