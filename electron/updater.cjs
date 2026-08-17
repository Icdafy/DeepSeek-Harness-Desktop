"use strict";

const { existsSync, readFileSync, renameSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function readEnabled(settingsFile, log) {
  if (!existsSync(settingsFile)) return true;
  try {
    const value = JSON.parse(readFileSync(settingsFile, "utf8"));
    return value.autoUpdateEnabled !== false;
  } catch (error) {
    log("warn", `Ignoring invalid desktop settings: ${error.message}`);
    return true;
  }
}

function writeEnabled(settingsFile, enabled) {
  const temporary = `${settingsFile}.tmp`;
  writeFileSync(temporary, `${JSON.stringify({ autoUpdateEnabled: enabled }, null, 2)}\n`, "utf8");
  renameSync(temporary, settingsFile);
}

function createUpdateController({ app, autoUpdater, dialog, log, getWindow }) {
  const settingsFile = path.join(app.getPath("userData"), "desktop-settings.json");
  let checkTimer = null;
  let intervalTimer = null;
  let downloadPromptShown = false;
  let state = {
    enabled: readEnabled(settingsFile, log),
    supported: app.isPackaged,
    currentVersion: app.getVersion(),
    availableVersion: null,
    percent: null,
    message: null,
    status: app.isPackaged ? "idle" : "development",
  };

  const broadcast = () => {
    const window = getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send("desktop-updates:state", state);
    }
  };
  const updateState = (patch) => {
    state = { ...state, ...patch };
    broadcast();
    return { ...state };
  };

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("checking-for-update", () => {
    updateState({ status: "checking", message: null, percent: null });
  });
  autoUpdater.on("update-available", (info) => {
    log("info", `Desktop update v${info.version} is available`);
    updateState({ status: "available", availableVersion: info.version, message: null });
  });
  autoUpdater.on("update-not-available", () => {
    updateState({ status: "up-to-date", availableVersion: null, message: null, percent: null });
  });
  autoUpdater.on("download-progress", (progress) => {
    updateState({ status: "downloading", percent: progress.percent });
  });
  autoUpdater.on("update-downloaded", (info) => {
    log("info", `Desktop update v${info.version} downloaded`);
    updateState({ status: "downloaded", availableVersion: info.version, percent: 100 });
    if (downloadPromptShown) return;
    downloadPromptShown = true;
    void dialog.showMessageBox(getWindow() ?? undefined, {
      type: "info",
      title: "DeepSeek Harness",
      message: `DeepSeek Harness v${info.version} 已准备就绪`,
      detail: "可以立即重启安装，也可以稍后退出应用时自动安装。",
      buttons: ["立即重启并安装", "稍后"],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall(false, true);
    });
  });
  autoUpdater.on("error", (error) => {
    log("error", `Desktop update failed: ${error.stack || error.message}`);
    updateState({ status: "error", message: error.message, percent: null });
  });

  const checkNow = async () => {
    if (!state.enabled) return updateState({ status: "disabled", message: null });
    if (!app.isPackaged) return updateState({ status: "development", supported: false });
    if (["checking", "downloading"].includes(state.status)) return { ...state };
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      log("error", `Desktop update check failed: ${error.stack || error.message}`);
      return updateState({ status: "error", message: error.message, percent: null });
    }
    return { ...state };
  };

  const setEnabled = async (enabled) => {
    const next = enabled === true;
    writeEnabled(settingsFile, next);
    updateState({ enabled: next, status: next ? (app.isPackaged ? "idle" : "development") : "disabled", message: null });
    if (next) await checkNow();
    return { ...state };
  };

  const start = () => {
    if (!state.enabled) {
      updateState({ status: "disabled" });
      return;
    }
    if (!app.isPackaged) {
      updateState({ status: "development", supported: false });
      return;
    }
    checkTimer = setTimeout(() => void checkNow(), 10_000);
    intervalTimer = setInterval(() => void checkNow(), CHECK_INTERVAL_MS);
    checkTimer.unref?.();
    intervalTimer.unref?.();
  };

  const stop = () => {
    if (checkTimer) clearTimeout(checkTimer);
    if (intervalTimer) clearInterval(intervalTimer);
  };

  return {
    checkNow,
    getState: () => ({ ...state }),
    setEnabled,
    start,
    stop,
  };
}

module.exports = { createUpdateController, readEnabled, writeEnabled };
