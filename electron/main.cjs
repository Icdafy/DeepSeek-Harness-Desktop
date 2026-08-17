"use strict";

const { app, BrowserWindow, Menu, dialog, session, shell } = require("electron");
const { spawn, spawnSync } = require("node:child_process");
const {
  appendFileSync,
  existsSync,
  mkdirSync,
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

const APP_ID = "ai.deepseek.harness.desktop";
const APP_NAME = "DeepSeek Harness Desktop";
const STARTUP_TIMEOUT_MS = 45_000;
const SHUTDOWN_TIMEOUT_MS = 3_000;
const LOG_MAX_BYTES = 2 * 1024 * 1024;
const SMOKE_TEST =
  process.argv.includes("--smoke-test") ||
  process.env.DSH_DESKTOP_SMOKE_TEST === "1";

app.setName(APP_NAME);
app.setAppUserModelId(APP_ID);

let mainWindow = null;
let harnessProcess = null;
let harnessUrl = null;
let quitting = false;
let logFile = null;

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
    process.stdout.write(`${line}\n`);
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

  log("info", `Starting Harness with data directory ${home}`);

  return new Promise((resolve, reject) => {
    let settled = false;
    let startupTimer = null;

    harnessProcess = spawn(
      paths.node,
      [paths.dsh, "--profile", "web", "--host", "127.0.0.1", "--port", "0"],
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
          `The local service exited with code ${code}. Use File → Restart Harness to try again.`,
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
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: "#0b1020",
    title: APP_NAME,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
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

function installMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Restart Harness",
          accelerator: "CmdOrCtrl+Shift+R",
          click: () => void restartHarness(),
        },
        {
          label: "Open Data Folder",
          click: () => void shell.openPath(dshHomePath()),
        },
        {
          label: "Open Log Folder",
          click: () => void shell.openPath(path.join(app.getPath("userData"), "logs")),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Desktop Releases",
          click: () =>
            openExternal("https://github.com/Icdafy/DeepSeek-Harness-Desktop/releases"),
        },
        {
          label: "DeepSeek Harness Documentation",
          click: () => openExternal("https://github.com/deepseek-ai/DeepSeek-Harness"),
        },
        { type: "separator" },
        {
          label: `About ${APP_NAME}`,
          click: () => {
            void dialog.showMessageBox(mainWindow ?? undefined, {
              type: "info",
              title: APP_NAME,
              message: `${APP_NAME} v${app.getVersion()}`,
              detail:
                "Desktop distribution of the MIT-licensed DeepSeek Harness developer preview.",
              buttons: ["OK"],
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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

    installMenu();
    createWindow();

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
  stopHarnessSync();
});

app.on("window-all-closed", () => app.quit());

process.on("uncaughtException", (error) => {
  log("error", `Uncaught exception: ${error.stack || error.message}`);
});

process.on("unhandledRejection", (reason) => {
  log("error", `Unhandled rejection: ${reason?.stack || String(reason)}`);
});
