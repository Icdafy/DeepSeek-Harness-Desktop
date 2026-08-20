"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createUpdateController,
  friendlyUpdateError,
  readEnabled,
  writeEnabled,
} = require("../electron/updater.cjs");

test("desktop update preference defaults on and persists both states", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "dsh-updater-"));
  const settings = path.join(directory, "desktop-settings.json");
  try {
    assert.equal(readEnabled(settings, () => {}), true);
    writeEnabled(settings, false);
    assert.equal(readEnabled(settings, () => {}), false);
    writeEnabled(settings, true);
    assert.equal(readEnabled(settings, () => {}), true);
    assert.deepEqual(JSON.parse(readFileSync(settings, "utf8")), { autoUpdateEnabled: true });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("desktop update preference preserves unrelated desktop settings", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "dsh-updater-"));
  const settings = path.join(directory, "desktop-settings.json");
  try {
    writeFileSync(settings, '{"harnessPort":43123}\n', "utf8");
    writeEnabled(settings, false);
    assert.deepEqual(JSON.parse(readFileSync(settings, "utf8")), {
      harnessPort: 43123,
      autoUpdateEnabled: false,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("development controller exposes a safe non-networking state", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "dsh-updater-"));
  const autoUpdater = new EventEmitter();
  autoUpdater.checkForUpdates = () => {
    throw new Error("development mode must not check the network");
  };
  const controller = createUpdateController({
    app: {
      getPath: () => directory,
      getVersion: () => "0.0.2",
      isPackaged: false,
    },
    autoUpdater,
    dialog: { showMessageBox: async () => ({ response: 1 }) },
    log: () => {},
    getWindow: () => null,
  });
  try {
    controller.start();
    assert.deepEqual(controller.getState(), {
      enabled: true,
      supported: false,
      currentVersion: "0.0.2",
      availableVersion: null,
      percent: null,
      message: null,
      status: "development",
    });
    assert.equal((await controller.setEnabled(false)).status, "disabled");
    assert.equal((await controller.setEnabled(true)).status, "development");
  } finally {
    controller.stop();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("packaged controller retries transient update checks", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "dsh-updater-"));
  const autoUpdater = new EventEmitter();
  let checks = 0;
  autoUpdater.checkForUpdates = async () => {
    checks += 1;
    autoUpdater.emit("checking-for-update");
    if (checks < 3) {
      const error = new Error("net::ERR_CONNECTION_RESET");
      autoUpdater.emit("error", error);
      throw error;
    }
    autoUpdater.emit("update-not-available", { version: "0.0.8" });
    return { isUpdateAvailable: false };
  };
  const controller = createUpdateController({
    app: {
      getPath: () => directory,
      getVersion: () => "0.0.8",
      isPackaged: true,
    },
    autoUpdater,
    dialog: { showMessageBox: async () => ({ response: 1 }) },
    log: () => {},
    getWindow: () => null,
    retryDelaysMs: [0, 0],
  });
  try {
    assert.equal((await controller.checkNow()).status, "up-to-date");
    assert.equal(checks, 3);
    assert.equal(autoUpdater.autoDownload, false);
  } finally {
    controller.stop();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("packaged controller retries update downloads and preserves updater integrity checks", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "dsh-updater-"));
  const autoUpdater = new EventEmitter();
  let downloads = 0;
  autoUpdater.checkForUpdates = async () => {
    autoUpdater.emit("checking-for-update");
    autoUpdater.emit("update-available", { version: "0.0.9" });
    return { isUpdateAvailable: true };
  };
  autoUpdater.downloadUpdate = async () => {
    downloads += 1;
    if (downloads < 3) {
      const error = new Error("read ECONNRESET");
      autoUpdater.emit("error", error);
      throw error;
    }
    autoUpdater.emit("download-progress", { percent: 100 });
    autoUpdater.emit("update-downloaded", { version: "0.0.9" });
    return [path.join(directory, "DeepSeek-Harness-Setup-0.0.9-x64.exe")];
  };
  const controller = createUpdateController({
    app: {
      getPath: () => directory,
      getVersion: () => "0.0.8",
      isPackaged: true,
    },
    autoUpdater,
    dialog: { showMessageBox: async () => ({ response: 1 }) },
    log: () => {},
    getWindow: () => null,
    retryDelaysMs: [0, 0],
  });
  try {
    const state = await controller.checkNow();
    assert.equal(state.status, "downloaded");
    assert.equal(state.availableVersion, "0.0.9");
    assert.equal(downloads, 3);
  } finally {
    controller.stop();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("network updater errors are translated into actionable Chinese guidance", () => {
  assert.equal(
    friendlyUpdateError(new Error("net::ERR_NAME_NOT_RESOLVED")),
    "无法连接更新服务器。请检查网络、系统代理或防火墙后重试；部分网络可能无法访问 GitHub。",
  );
  assert.equal(
    friendlyUpdateError(new Error("HTTP 429 rate limit exceeded")),
    "更新服务器暂时限制了访问，请稍后再试。",
  );
});
