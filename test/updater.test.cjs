"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createUpdateController, readEnabled, writeEnabled } = require("../electron/updater.cjs");

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
