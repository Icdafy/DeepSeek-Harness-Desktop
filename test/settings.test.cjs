"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  readHarnessPort,
  readWindowState,
  writeHarnessPort,
  writeWindowState,
} = require("../electron/settings.cjs");

test("stable Harness port persists alongside window state", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "dsh-settings-"));
  const settings = path.join(directory, "desktop-settings.json");
  const windowState = {
    bounds: { x: 120, y: 80, width: 1280, height: 800 },
    maximized: true,
  };
  try {
    writeHarnessPort(settings, 43123);
    writeWindowState(settings, windowState);
    assert.equal(readHarnessPort(settings), 43123);
    assert.deepEqual(readWindowState(settings), windowState);
    assert.deepEqual(JSON.parse(readFileSync(settings, "utf8")), {
      harnessPort: 43123,
      windowState,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("invalid persisted geometry and ports are ignored", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "dsh-settings-"));
  const settings = path.join(directory, "desktop-settings.json");
  try {
    assert.throws(() => writeHarnessPort(settings, 80), RangeError);
    writeWindowState(settings, {
      bounds: { x: 0, y: 0, width: 640, height: 480 },
      maximized: false,
    });
    assert.equal(readHarnessPort(settings), null);
    assert.equal(readWindowState(settings), null);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
