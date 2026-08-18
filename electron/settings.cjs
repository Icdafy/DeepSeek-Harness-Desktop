"use strict";

const { existsSync, readFileSync, renameSync, writeFileSync } = require("node:fs");

function readDesktopSettings(settingsFile, log = () => {}) {
  if (!existsSync(settingsFile)) return {};
  try {
    const value = JSON.parse(readFileSync(settingsFile, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch (error) {
    log("warn", `Ignoring invalid desktop settings: ${error.message}`);
    return {};
  }
}

function writeDesktopSettings(settingsFile, settings) {
  const temporary = `${settingsFile}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  renameSync(temporary, settingsFile);
}

function updateDesktopSettings(settingsFile, patch, log = () => {}) {
  const next = { ...readDesktopSettings(settingsFile, log), ...patch };
  writeDesktopSettings(settingsFile, next);
  return next;
}

function readHarnessPort(settingsFile, log = () => {}) {
  const port = readDesktopSettings(settingsFile, log).harnessPort;
  return Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : null;
}

function writeHarnessPort(settingsFile, port, log = () => {}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new RangeError(`Invalid Harness port: ${port}`);
  }
  updateDesktopSettings(settingsFile, { harnessPort: port }, log);
}

function readWindowState(settingsFile, log = () => {}) {
  const state = readDesktopSettings(settingsFile, log).windowState;
  const bounds = state?.bounds;
  if (
    !bounds ||
    !Number.isInteger(bounds.x) ||
    !Number.isInteger(bounds.y) ||
    !Number.isInteger(bounds.width) ||
    !Number.isInteger(bounds.height) ||
    bounds.width < 960 ||
    bounds.height < 640
  ) {
    return null;
  }
  return {
    bounds: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    },
    maximized: state.maximized === true,
  };
}

function writeWindowState(settingsFile, state, log = () => {}) {
  updateDesktopSettings(settingsFile, { windowState: state }, log);
}

module.exports = {
  readDesktopSettings,
  readHarnessPort,
  readWindowState,
  updateDesktopSettings,
  writeDesktopSettings,
  writeHarnessPort,
  writeWindowState,
};
