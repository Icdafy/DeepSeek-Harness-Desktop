"use strict";

const path = require("node:path");
const { readDesktopSettings, updateDesktopSettings } = require("./settings.cjs");

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const UPDATE_RETRY_DELAYS_MS = [1_000, 4_000];

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function friendlyUpdateError(error) {
  const detail = `${error?.code ?? ""} ${error?.message ?? error ?? ""}`;
  if (/403|429|rate.?limit/i.test(detail)) {
    return "更新服务器暂时限制了访问，请稍后再试。";
  }
  if (
    /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ERR_(?:INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION|NETWORK|TIMED_OUT)|net::/i.test(
      detail,
    )
  ) {
    return "无法连接更新服务器。请检查网络、系统代理或防火墙后重试；部分网络可能无法访问 GitHub。";
  }
  return `更新失败：${error?.message ?? "未知错误"}`;
}

function readEnabled(settingsFile, log) {
  return readDesktopSettings(settingsFile, log).autoUpdateEnabled !== false;
}

function writeEnabled(settingsFile, enabled) {
  updateDesktopSettings(settingsFile, { autoUpdateEnabled: enabled });
}

function createUpdateController({
  app,
  autoUpdater,
  dialog,
  log,
  getWindow,
  retryDelaysMs = UPDATE_RETRY_DELAYS_MS,
}) {
  const settingsFile = path.join(app.getPath("userData"), "desktop-settings.json");
  let checkTimer = null;
  let intervalTimer = null;
  let downloadPromptShown = false;
  let activeOperation = null;
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

  autoUpdater.autoDownload = false;
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
    if (!activeOperation) {
      updateState({ status: "error", message: friendlyUpdateError(error), percent: null });
    }
  });

  const withRetries = async (operation, task) => {
    let lastError = null;
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
      try {
        return await task();
      } catch (error) {
        lastError = error;
        if (attempt === retryDelaysMs.length) break;
        const delay = retryDelaysMs[attempt];
        log(
          "warn",
          `Desktop update ${operation} attempt ${attempt + 1} failed; retrying in ${delay} ms: ${error.message}`,
        );
        updateState({
          status: operation === "download" ? "downloading" : "checking",
          message: `网络连接不稳定，正在重试（${attempt + 2}/${retryDelaysMs.length + 1}）…`,
          percent: operation === "download" ? state.percent : null,
        });
        await wait(delay);
      }
    }
    throw lastError;
  };

  const checkNow = async () => {
    if (!state.enabled) return updateState({ status: "disabled", message: null });
    if (!app.isPackaged) return updateState({ status: "development", supported: false });
    if (activeOperation || ["checking", "downloading", "downloaded"].includes(state.status)) {
      return { ...state };
    }
    try {
      activeOperation = "check";
      const result = await withRetries("check", () => autoUpdater.checkForUpdates());
      if (result?.isUpdateAvailable) {
        activeOperation = "download";
        await withRetries("download", () => autoUpdater.downloadUpdate());
      }
    } catch (error) {
      log(
        "error",
        `Desktop update ${activeOperation ?? "operation"} failed after retries: ${error.stack || error.message}`,
      );
      return updateState({ status: "error", message: friendlyUpdateError(error), percent: null });
    } finally {
      activeOperation = null;
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

module.exports = { createUpdateController, friendlyUpdateError, readEnabled, writeEnabled };
