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
      padding: 0 148px 0 0;
      color: var(--dsw-alias-label-primary, #171717);
      background: color-mix(in srgb, var(--dsw-alias-bg-layer-1, #f7f7f8) 88%, transparent);
      border: 0;
      box-shadow: 0 10px 24px -24px color-mix(in srgb, var(--dsw-alias-label-primary, #171717) 26%, transparent);
      backdrop-filter: blur(18px) saturate(1.08);
      user-select: none;
    }
  `;
  document.head.appendChild(style);

  const titlebar = document.createElement("div");
  titlebar.id = "dsh-desktop-titlebar";
  titlebar.setAttribute("aria-hidden", "true");
  document.body.prepend(titlebar);

  let colorTimer = null;
  const normalizeColor = (value) => {
    const srgb = value.match(
      /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/i,
    );
    if (!srgb) return value;
    const channel = (part) => Math.round(Math.min(1, Number(part)) * 255);
    return `rgba(${channel(srgb[1])}, ${channel(srgb[2])}, ${channel(srgb[3])}, ${srgb[4] ?? 1})`;
  };
  const syncColors = () => {
    clearTimeout(colorTimer);
    colorTimer = setTimeout(() => {
      const computed = getComputedStyle(titlebar);
      ipcRenderer.send("desktop:titlebar-colors", {
        background: "rgba(0, 0, 0, 0)",
        foreground: normalizeColor(computed.color),
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
