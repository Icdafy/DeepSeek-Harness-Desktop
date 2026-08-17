"use strict";

const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  nativeImage,
  nativeTheme,
  session,
  shell,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const { spawn, spawnSync } = require("node:child_process");
const {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} = require("node:fs");
const path = require("node:path");
const {
  extractHarnessUrl,
  isAllowedAppNavigation,
  isSafeExternalUrl,
  prependPath,
} = require("./runtime-utils.cjs");
const { createUpdateController } = require("./updater.cjs");

// GUI launches may outlive their parent console. Ignore closed-pipe errors so
// logging cannot become a recursive uncaught-exception loop.
process.stdout?.on?.("error", () => {});
process.stderr?.on?.("error", () => {});

const APP_ID = "ai.deepseek.harness.desktop";
const APP_NAME = "DeepSeek Harness";
const STARTUP_TIMEOUT_MS = 45_000;
const SHUTDOWN_TIMEOUT_MS = 3_000;
const LOG_MAX_BYTES = 2 * 1024 * 1024;
const SMOKE_TEST =
  process.argv.includes("--smoke-test") ||
  process.env.DSH_DESKTOP_SMOKE_TEST === "1";

app.setName(APP_NAME);
app.setAppUserModelId(APP_ID);

function migrateLegacyUserData() {
  const target = path.join(app.getPath("appData"), APP_NAME);
  const legacy = path.join(app.getPath("appData"), "DeepSeek Harness Desktop");
  if (!existsSync(target) && existsSync(legacy)) {
    try {
      renameSync(legacy, target);
    } catch {
      // Keep the legacy directory untouched if another process is using it.
    }
  }
  app.setPath("userData", target);
}

migrateLegacyUserData();

let mainWindow = null;
let harnessProcess = null;
let harnessUrl = null;
let quitting = false;
let logFile = null;
let updateController = null;

function ensureDirectory(directory) {
  mkdirSync(directory, { recursive: true });
  return directory;
}

function configureLogging() {
  const logDirectory = ensureDirectory(path.join(app.getPath("userData"), "logs"));
  logFile = path.join(logDirectory, "desktop.log");

  if (existsSync(logFile) && statSync(logFile).size > LOG_MAX_BYTES) {
    const previous = `${logFile}.1`;
    try {
      rmSync(previous, { force: true });
      renameSync(logFile, previous);
    } catch {
      // Log rotation failure must never prevent the application from opening.
    }
  }
}

function log(level, message) {
  const line = `${new Date().toISOString()} [${level}] ${message}`;
  if (SMOKE_TEST || !app.isPackaged) {
    try {
      process.stdout.write(`${line}\n`);
    } catch {
      // Detached GUI launches can close stdout before Electron exits.
    }
  }
  if (logFile) {
    try {
      appendFileSync(logFile, `${line}\n`, "utf8");
    } catch {
      // The desktop app remains usable even if its log directory is read-only.
    }
  }
}

function runtimePaths() {
  if (app.isPackaged) {
    return {
      node: path.join(process.resourcesPath, "runtime", "node.exe"),
      dsh: path.join(
        process.resourcesPath,
        "harness",
        "node_modules",
        "@deepseek-ai",
        "dsh",
        "lib",
        "bin.js",
      ),
      bin: path.join(process.resourcesPath, "harness", "node_modules", ".bin"),
    };
  }

  const root = app.getAppPath();
  return {
    node: path.join(root, ".runtime", "node.exe"),
    dsh: path.join(
      root,
      "runtime",
      "node_modules",
      "@deepseek-ai",
      "dsh",
      "lib",
      "bin.js",
    ),
    bin: path.join(root, "runtime", "node_modules", ".bin"),
  };
}

function desktopIntegrationPaths() {
  if (app.isPackaged) {
    return {
      icon: path.join(process.resourcesPath, "desktop", "icon.png"),
      patch: path.join(
        process.resourcesPath,
        "harness",
        "node_modules",
        "@deepseek-harness",
        "desktop-updater",
        "cordis.patch.yml",
      ),
      plugin: path.join(
        process.resourcesPath,
        "harness",
        "node_modules",
        "@deepseek-harness",
        "desktop-updater",
      ),
    };
  }

  const root = app.getAppPath();
  return {
    icon: path.join(root, "build", "icon.png"),
    patch: path.join(root, "desktop-updater", "cordis.patch.yml"),
    plugin: path.join(root, "desktop-updater"),
  };
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function ensureDesktopUpdaterPlugin(home, paths, environment) {
  const source = desktopIntegrationPaths().plugin;
  const target = ensureDirectory(path.join(home, "profiles", "web", "plugins", "desktop-updater"));
  ensureDirectory(path.join(target, "lib"));

  for (const relative of [
    "package.json",
    "cordis.patch.yml",
    path.join("lib", "index.js"),
    path.join("lib", "client.js"),
  ]) {
    const sourceFile = path.join(source, relative);
    if (!existsSync(sourceFile)) {
      throw new Error(`Desktop updater plugin file is missing: ${sourceFile}`);
    }
    copyFileSync(sourceFile, path.join(target, relative));
  }

  const sourceVersion = readJson(path.join(source, "package.json"))?.version;
  const installedManifest = path.join(
    home,
    "profiles",
    "web",
    "node_modules",
    "@deepseek-harness",
    "desktop-updater",
    "package.json",
  );
  const installedVersion = readJson(installedManifest)?.version;
  if (sourceVersion && installedVersion === sourceVersion) return;

  log("info", `Installing desktop updater plugin v${sourceVersion ?? "unknown"}`);
  const result = spawnSync(
    paths.node,
    [
      paths.dsh,
      "plugin",
      "--profile",
      "web",
      "add",
      "--offline",
      "file:plugins/desktop-updater",
    ],
    {
      cwd: home,
      env: environment,
      windowsHide: true,
      encoding: "utf8",
      timeout: STARTUP_TIMEOUT_MS,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Unable to install desktop updater plugin: ${(result.stderr || result.stdout || "unknown error").trim()}`,
    );
  }
}

function dshHomePath() {
  return ensureDirectory(path.join(app.getPath("userData"), "dsh-home"));
}

function consumeLines(stream, callback) {
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) callback(line);
    }
  });
  stream.on("end", () => {
    if (pending.trim()) callback(pending);
  });
}

async function waitForHttp(url) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(
    `Harness did not become ready within ${STARTUP_TIMEOUT_MS / 1000} seconds: ${lastError?.message ?? "unknown error"}`,
  );
}

function startHarness() {
  if (harnessProcess && harnessProcess.exitCode === null && harnessUrl) {
    return Promise.resolve(harnessUrl);
  }

  const paths = runtimePaths();
  if (!existsSync(paths.node)) {
    return Promise.reject(new Error(`Bundled Node.js runtime is missing: ${paths.node}`));
  }
  if (!existsSync(paths.dsh)) {
    return Promise.reject(new Error(`DeepSeek Harness runtime is missing: ${paths.dsh}`));
  }

  const home = dshHomePath();
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  environment.DSH_HOME = home;
  environment.Path = prependPath(
    [path.dirname(paths.node), paths.bin],
    environment.Path || environment.PATH || "",
    path.delimiter,
  );
  environment.PATH = environment.Path;

  try {
    ensureDesktopUpdaterPlugin(home, paths, environment);
  } catch (error) {
    return Promise.reject(error);
  }

  log("info", `Starting Harness with data directory ${home}`);

  return new Promise((resolve, reject) => {
    let settled = false;
    let startupTimer = null;

    harnessProcess = spawn(
      paths.node,
      [
        paths.dsh,
        "--profile",
        "web",
        "--patch",
        desktopIntegrationPaths().patch,
        "--host",
        "127.0.0.1",
        "--port",
        "0",
      ],
      {
        cwd: home,
        env: environment,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(startupTimer);
      reject(error);
    };

    startupTimer = setTimeout(() => {
      rejectOnce(new Error("Timed out while waiting for DeepSeek Harness to report its address."));
    }, STARTUP_TIMEOUT_MS);

    consumeLines(harnessProcess.stdout, (line) => {
      log("harness", line);
      const reportedUrl = extractHarnessUrl(line);
      if (!reportedUrl || settled) return;

      harnessUrl = reportedUrl;
      waitForHttp(harnessUrl)
        .then(() => {
          if (settled) return;
          settled = true;
          clearTimeout(startupTimer);
          log("info", `Harness is ready at ${harnessUrl}`);
          resolve(harnessUrl);
        })
        .catch(rejectOnce);
    });

    consumeLines(harnessProcess.stderr, (line) => log("harness-error", line));

    harnessProcess.once("error", (error) => {
      log("error", `Harness process error: ${error.stack || error.message}`);
      rejectOnce(error);
    });

    harnessProcess.once("exit", (code, signal) => {
      const unexpected = !quitting && code !== 0;
      log("info", `Harness exited with code=${code} signal=${signal}`);
      harnessProcess = null;
      harnessUrl = null;
      if (!settled) {
        rejectOnce(new Error(`DeepSeek Harness exited before startup (code ${code}).`));
      } else if (unexpected && mainWindow && !mainWindow.isDestroyed()) {
        void showFatalError(
          "DeepSeek Harness stopped unexpectedly",
          `The local service exited with code ${code}. Close and reopen DeepSeek Harness to try again.`,
        );
      }
    });
  });
}

function stopHarnessSync() {
  const child = harnessProcess;
  harnessProcess = null;
  harnessUrl = null;
  if (!child || child.exitCode !== null) return;

  try {
    child.kill();
  } catch {
    // Continue to the process-tree fallback below.
  }

  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      windowsHide: true,
      stdio: "ignore",
      timeout: SHUTDOWN_TIMEOUT_MS,
    });
  }
}

async function stopHarness() {
  const child = harnessProcess;
  if (!child || child.exitCode !== null) {
    harnessProcess = null;
    harnessUrl = null;
    return;
  }

  const exited = new Promise((resolve) => child.once("exit", resolve));
  try {
    child.kill();
  } catch {
    // The process may already be exiting.
  }

  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, SHUTDOWN_TIMEOUT_MS)),
  ]);

  if (child.exitCode === null && process.platform === "win32" && child.pid) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      windowsHide: true,
      stdio: "ignore",
      timeout: SHUTDOWN_TIMEOUT_MS,
    });
  }

  harnessProcess = null;
  harnessUrl = null;
}

function openExternal(targetUrl) {
  if (isSafeExternalUrl(targetUrl)) {
    void shell.openExternal(targetUrl);
  } else {
    log("warn", `Blocked malformed external URL: ${targetUrl}`);
  }
}

function createWindow() {
  const dark = nativeTheme.shouldUseDarkColors;
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: dark ? "#171719" : "#f7f7f8",
    icon: desktopIntegrationPaths().icon,
    title: APP_NAME,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: dark ? "#171719" : "#f7f7f8",
      symbolColor: dark ? "#f5f5f5" : "#171717",
      height: 40,
    },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAllowedAppNavigation(url, harnessUrl)) openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAllowedAppNavigation(url, harnessUrl)) return;
    event.preventDefault();
    openExternal(url);
  });

  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  void mainWindow.loadFile(path.join(__dirname, "loading.html"));
  return mainWindow;
}

async function restartHarness() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  await mainWindow.loadFile(path.join(__dirname, "loading.html"));
  await stopHarness();

  try {
    const url = await startHarness();
    await mainWindow.loadURL(url);
  } catch (error) {
    await showFatalError("Unable to restart DeepSeek Harness", error.message);
  }
}

async function showFatalError(title, detail) {
  log("error", `${title}: ${detail}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    await mainWindow.loadFile(path.join(__dirname, "error.html"));
  }
  if (!SMOKE_TEST) {
    await dialog.showMessageBox(mainWindow ?? undefined, {
      type: "error",
      title: APP_NAME,
      message: title,
      detail,
      buttons: ["OK"],
    });
  }
}

async function runSmokeTest() {
  try {
    const url = await startHarness();
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    const body = await response.text();
    if (!response.ok || !body.includes("DeepSeek Harness")) {
      throw new Error(`Unexpected smoke-test response: HTTP ${response.status}`);
    }
    if (process.env.DSH_DESKTOP_SMOKE_RESULT) {
      writeFileSync(
        process.env.DSH_DESKTOP_SMOKE_RESULT,
        `OK ${app.getVersion()} ${url}\n`,
        "utf8",
      );
    }
    process.stdout.write(`DSH_DESKTOP_SMOKE_TEST_OK ${url}\n`);
    await stopHarness();
    app.exit(0);
  } catch (error) {
    if (process.env.DSH_DESKTOP_SMOKE_RESULT) {
      try {
        writeFileSync(
          process.env.DSH_DESKTOP_SMOKE_RESULT,
          `FAILED ${error.stack || error.message}\n`,
          "utf8",
        );
      } catch {
        // Preserve the original smoke-test failure below.
      }
    }
    process.stderr.write(`DSH_DESKTOP_SMOKE_TEST_FAILED ${error.stack || error.message}\n`);
    await stopHarness();
    app.exit(1);
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    configureLogging();
    session.defaultSession.setPermissionRequestHandler(
      (_webContents, _permission, callback) => callback(false),
    );

    if (SMOKE_TEST) {
      await runSmokeTest();
      return;
    }

    Menu.setApplicationMenu(null);
    createWindow();

    updateController = createUpdateController({
      app,
      autoUpdater,
      dialog,
      log,
      getWindow: () => mainWindow,
    });
    ipcMain.handle("desktop-updates:get-state", () => updateController.getState());
    ipcMain.handle("desktop-updates:set-enabled", (_event, enabled) =>
      updateController.setEnabled(enabled),
    );
    ipcMain.handle("desktop-updates:check-now", () => updateController.checkNow());
    ipcMain.handle("desktop:get-window-metadata", () => ({
      appName: APP_NAME,
      iconDataUrl: nativeImage
        .createFromPath(desktopIntegrationPaths().icon)
        .resize({ width: 48, height: 48 })
        .toDataURL(),
    }));
    ipcMain.on("desktop:titlebar-colors", (_event, colors) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const isCssColor = (value) =>
        typeof value === "string" &&
        (/^#[\da-f]{3,8}$/i.test(value) || /^rgba?\([\d\s.,%]+\)$/i.test(value));
      if (!isCssColor(colors?.background) || !isCssColor(colors?.foreground)) return;
      mainWindow.setTitleBarOverlay({
        color: colors.background,
        symbolColor: colors.foreground,
        height: 40,
      });
    });
    updateController.start();

    try {
      const url = await startHarness();
      await mainWindow?.loadURL(url);
    } catch (error) {
      await showFatalError("Unable to start DeepSeek Harness", error.message);
    }
  });
}

app.on("before-quit", () => {
  quitting = true;
  updateController?.stop();
  stopHarnessSync();
});

app.on("window-all-closed", () => app.quit());

process.on("uncaughtException", (error) => {
  log("error", `Uncaught exception: ${error.stack || error.message}`);
});

process.on("unhandledRejection", (reason) => {
  log("error", `Unhandled rejection: ${reason?.stack || String(reason)}`);
});
