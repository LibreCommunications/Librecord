import { app, BrowserWindow, desktopCapturer, ipcMain, Notification, shell, session } from "electron";
import { join } from "path";
import * as fs from "fs";
import { initUpdater } from "./updater";
import { initTray, destroyTray } from "./tray";
import { isAutostartEnabled, setAutostart } from "./autostart";
import { setupPlatformScreenCapture } from "./platform";

// Work around GPU process crashes on some Linux drivers (e.g. radv)
app.commandLine.appendSwitch("disable-gpu-sandbox");

// Ignore certificate errors for self-signed dev certs
app.commandLine.appendSwitch("ignore-certificate-errors");

// Linux Wayland/X11 display server detection
if (process.platform === "linux") {
  const isWayland = !!process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === "wayland";
  if (isWayland) {
    app.commandLine.appendSwitch("ozone-platform", "wayland");
  } else {
    app.commandLine.appendSwitch("ozone-platform-hint", "auto");
  }

}

// Register librecord:// protocol handler
if (process.defaultApp) {
  app.setAsDefaultProtocolClient("librecord", process.execPath, [process.argv[1]]);
} else {
  app.setAsDefaultProtocolClient("librecord");
}

// Single instance lock — focus existing window if already running
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

// Persist minimizeToTray setting across restarts
const settingsFile = join(app.getPath("userData"), "desktop-settings.json");

function loadSettings(): { minimizeToTray: boolean } {
  try {
    return JSON.parse(fs.readFileSync(settingsFile, "utf-8"));
  } catch {
    return { minimizeToTray: true };
  }
}

function saveSettings(settings: { minimizeToTray: boolean }) {
  fs.writeFileSync(settingsFile, JSON.stringify(settings), "utf-8");
}

let minimizeToTray = loadSettings().minimizeToTray;

// --- Deep link parsing ---

interface DeepLink {
  type: string;
  params: string[];
}

function parseDeepLink(url: string): DeepLink | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "librecord:") return null;
    // librecord://guild/abc/def → hostname="guild", pathname="/abc/def"
    const type = parsed.hostname;
    const params = parsed.pathname.split("/").filter(Boolean);
    return type ? { type, params } : null;
  } catch {
    return null;
  }
}

function handleDeepLinkUrl(url: string) {
  const link = parseDeepLink(url);
  if (!link || !mainWindow) return;

  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("deep-link", link);
}

// --- Window creation ---

function createWindow() {
  const startHidden = process.argv.includes("--hidden");

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 560,
    title: "Librecord",
    backgroundColor: "#1e1f22",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: app.isPackaged,
      preload: join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.on("ready-to-show", () => {
    if (!startHidden) {
      mainWindow?.show();
    }
  });

  // Minimize to tray instead of closing
  mainWindow.on("close", (e) => {
    if (minimizeToTray && mainWindow && !isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Dev: load Vite dev server. Prod: load built files.
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
}

// Accept self-signed certs in dev (localhost API uses dev certs)
app.on("certificate-error", (event, _webContents, _url, _error, _cert, callback) => {
  event.preventDefault();
  callback(true);
});

app.on("before-quit", (e) => {
  if (isQuitting) return; // Already in shutdown sequence
  isQuitting = true;

  if (mainWindow && !mainWindow.isDestroyed()) {
    e.preventDefault();
    // Try to call renderer cleanup (disconnect voice, stop capture).
    // If the renderer is gone or unresponsive, the safety timeout
    // ensures we still quit within 3 seconds.
    mainWindow.webContents.executeJavaScript(
      `window.__librecordCleanup ? window.__librecordCleanup() : Promise.resolve()`
    ).catch(() => {
      // Renderer already destroyed or errored — that's fine.
    }).finally(() => {
      app.quit();
    });
    setTimeout(() => {
      // Safety: force quit if cleanup hangs.
      try { app.exit(0); } catch { /* ignore */ }
    }, 3000);
  }
});

app.on("second-instance", (_event, argv) => {
  if (mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  // Deep link URL is in argv on Windows/Linux
  const url = argv.find((arg) => arg.startsWith("librecord://"));
  if (url) handleDeepLinkUrl(url);
});

// macOS deep link handler
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLinkUrl(url);
});

app.whenReady().then(() => {
  // Disable web security for the desktop app so CORS doesn't apply.
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    delete headers["Origin"];
    delete headers["origin"];
    delete headers["Referer"];
    delete headers["referer"];
    callback({ requestHeaders: headers });
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    delete headers["content-security-policy"];
    delete headers["Content-Security-Policy"];
    delete headers["x-frame-options"];
    delete headers["X-Frame-Options"];
    callback({ responseHeaders: headers });
  });

  // Screen share (#122, #76)
  // Grant all permissions (needed for display-capture)
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(true);
  });
  session.defaultSession.setPermissionCheckHandler(() => true);

  // Linux: pipecap handles screen capture natively via PipeWire (IPC from renderer).
  // The setDisplayMediaRequestHandler is not needed on Linux — pipecap bypasses
  // getDisplayMedia entirely and provides a MediaStream directly.
  // Windows/macOS: custom in-app source picker via desktopCapturer.
  if (process.platform !== "linux") {
    let abortPreviousPick: (() => void) | null = null;

    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
      if (abortPreviousPick) {
        abortPreviousPick();
        abortPreviousPick = null;
      }

      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true,
      });

      if (sources.length === 0) {
        try { callback({}); } catch { /* expected — Electron throws to deny request */ }
        return;
      }

      const serialized = sources.map(s => ({
        id: s.id,
        name: s.name,
        thumbnailDataUrl: s.thumbnail.toDataURL(),
        displayId: s.display_id,
        appIconDataUrl: !s.appIcon || s.appIcon.isEmpty() ? null : s.appIcon.toDataURL(),
      }));
      mainWindow?.webContents.send("screen-share-pick", serialized);

      const selectedId = await new Promise<string | null>((resolve) => {
        const cleanup = () => {
          ipcMain.removeListener("screen-share-selected", onSelected);
          ipcMain.removeListener("screen-share-cancelled", onCancelled);
          mainWindow?.removeListener("closed", onWindowClosed);
          if (abortPreviousPick === abort) abortPreviousPick = null;
        };
        const onSelected = (_e: Electron.IpcMainEvent, sourceId: string) => {
          cleanup();
          resolve(sourceId);
        };
        const onCancelled = () => {
          cleanup();
          resolve(null);
        };
        const onWindowClosed = () => {
          cleanup();
          resolve(null);
        };
        const abort = () => {
          cleanup();
          resolve(null);
        };

        abortPreviousPick = abort;
        ipcMain.once("screen-share-selected", onSelected);
        ipcMain.once("screen-share-cancelled", onCancelled);
        mainWindow?.once("closed", onWindowClosed);
      });

      if (!selectedId) {
        try { callback({}); } catch { /* expected — Electron throws to deny request */ }
        return;
      }

      const selected = sources.find(s => s.id === selectedId);
      if (!selected) {
        try { callback({}); } catch { /* expected — Electron throws to deny request */ }
        return;
      }

      // Audio capture policy on Windows:
      //   - Window source: pass `audio: "loopback"`. On Win11 + recent
      //     Chromium, WGC delivers per-window audio (i.e. only the
      //     captured window's output, not the system mix), so the
      //     meeting's audio doesn't loop back.
      //   - Screen source: there is no per-process audio extraction at
      //     the JS / getDisplayMedia level on Windows. `loopback` would
      //     capture the full system mix, including the meeting we're
      //     in, and remote participants would hear themselves echoed.
      //     Drop audio for screen sources entirely; the renderer toasts
      //     the user about it.
      const isWindow = selected.id.startsWith("window:");
      if (request.audioRequested && process.platform === "win32" && isWindow) {
        callback({ video: selected, audio: "loopback" });
      } else {
        callback({ video: selected });
      }
    });
  }

  // Per-platform native audio/capture bridge (pipecap on Linux, winaudio on Windows).
  setupPlatformScreenCapture(app, ipcMain, () => mainWindow);

  // IPC: app version
  ipcMain.handle("desktop:getAppVersion", () => app.getVersion());

  // IPC: desktop settings
  ipcMain.handle("desktop:getAutostart", () => isAutostartEnabled());
  ipcMain.handle("desktop:setAutostart", (_e, enabled: boolean) => setAutostart(enabled));
  ipcMain.handle("desktop:getMinimizeToTray", () => minimizeToTray);
  ipcMain.handle("desktop:setMinimizeToTray", (_e, enabled: boolean) => {
    minimizeToTray = enabled;
    saveSettings({ minimizeToTray });
    return minimizeToTray;
  });

  // IPC: native notifications (#105)
  ipcMain.handle("desktop:showNotification", (_e, opts: { title: string; body: string; channelId?: string }) => {
    const iconPath = join(__dirname, "../build/icons/256x256.png");
    const notification = new Notification({
      title: opts.title,
      body: opts.body,
      icon: iconPath,
      silent: true,
    });

    notification.on("click", () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        if (opts.channelId) {
          mainWindow.webContents.send("navigate", opts.channelId);
        }
      }
    });

    notification.show();
  });

  createWindow();
  initTray(() => mainWindow);
  initUpdater(() => mainWindow);

  // Show post-update notification if version changed since last launch
  const currentVersion = app.getVersion();
  const versionFile = join(app.getPath("userData"), "last-version.txt");
  let wasUpdated = false;
  try {
    const lastVersion = fs.readFileSync(versionFile, "utf-8").trim();
    if (lastVersion && lastVersion !== currentVersion) {
      wasUpdated = true;
      const iconPath = join(__dirname, "../build/icons/256x256.png");
      const notification = new Notification({
        title: "Librecord Updated",
        body: `Successfully updated to v${currentVersion}.`,
        icon: iconPath,
      });
      notification.on("click", () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      });
      notification.show();
    }
  } catch {
    // First launch or file doesn't exist — ignore
  }
  fs.writeFileSync(versionFile, currentVersion, "utf-8");

  // Handle deep link and update-installed IPC after renderer is ready
  const startupUrl = process.argv.find((arg) => arg.startsWith("librecord://"));
  if (mainWindow && (startupUrl || wasUpdated)) {
    mainWindow.webContents.once("did-finish-load", () => {
      if (startupUrl) handleDeepLinkUrl(startupUrl);
      if (wasUpdated) mainWindow?.webContents.send("update-installed", currentVersion);
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !minimizeToTray) {
    destroyTray();
    app.quit();
  }
});
