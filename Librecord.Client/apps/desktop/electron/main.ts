import { app, BrowserWindow, shell, session } from "electron";
import { join } from "path";
import { initUpdater } from "./updater";

// Work around GPU process crashes on some Linux drivers (e.g. radv)
app.commandLine.appendSwitch("disable-gpu-sandbox");

// Ignore certificate errors for self-signed dev certs
app.commandLine.appendSwitch("ignore-certificate-errors");

let mainWindow: BrowserWindow | null = null;

function createWindow() {
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
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
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

app.whenReady().then(() => {
  // Disable web security for the desktop app so CORS doesn't apply.
  // This is safe because the desktop app only loads our own code.
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

  createWindow();
  initUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
