import { app, BrowserWindow, desktopCapturer, ipcMain, Notification, shell, session } from "electron";
import { join } from "path";
import { initUpdater } from "./updater";
import { initTray, destroyTray } from "./tray";
import { isAutostartEnabled, setAutostart } from "./autostart";

// Work around GPU process crashes on some Linux drivers (e.g. radv)
app.commandLine.appendSwitch("disable-gpu-sandbox");

// Ignore certificate errors for self-signed dev certs
app.commandLine.appendSwitch("ignore-certificate-errors");

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
let minimizeToTray = true;
let isQuitting = false;

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

app.on("before-quit", () => {
  isQuitting = true;
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

  // Allow screen share with system audio (#108/#76)
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    const sources = await desktopCapturer.getSources({ types: ["screen", "window"] });
    if (sources.length > 0) {
      callback({ video: sources[0] });
    } else {
      callback({});
    }
  });

  // IPC: desktop settings
  ipcMain.handle("desktop:getAutostart", () => isAutostartEnabled());
  ipcMain.handle("desktop:setAutostart", (_e, enabled: boolean) => setAutostart(enabled));
  ipcMain.handle("desktop:getMinimizeToTray", () => minimizeToTray);
  ipcMain.handle("desktop:setMinimizeToTray", (_e, enabled: boolean) => {
    minimizeToTray = enabled;
    return minimizeToTray;
  });

  // IPC: native notifications (#105)
  ipcMain.handle("desktop:showNotification", (_e, opts: { title: string; body: string; channelId?: string }) => {
    const iconPath = join(__dirname, "../dist/librecord.svg");
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
  initUpdater();

  // Handle deep link from startup args
  const startupUrl = process.argv.find((arg) => arg.startsWith("librecord://"));
  if (startupUrl && mainWindow) {
    mainWindow.webContents.once("did-finish-load", () => handleDeepLinkUrl(startupUrl));
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
