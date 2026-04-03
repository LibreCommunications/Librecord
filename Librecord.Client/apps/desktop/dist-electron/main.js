import { BrowserWindow, app, shell } from "electron";
import { join } from "path";
import { autoUpdater } from "electron-updater";
//#region electron/updater.ts
function initUpdater() {
	if (!app.isPackaged) return;
	autoUpdater.autoDownload = true;
	autoUpdater.autoInstallOnAppQuit = true;
	autoUpdater.on("update-available", (info) => {
		console.log("Update available:", info.version);
	});
	autoUpdater.on("update-downloaded", (info) => {
		console.log("Update downloaded:", info.version, "— will install on quit");
	});
	autoUpdater.on("error", (err) => {
		console.error("Auto-update error:", err.message);
	});
	autoUpdater.checkForUpdatesAndNotify();
}
//#endregion
//#region electron/main.ts
var mainWindow = null;
function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1280,
		height: 800,
		minWidth: 940,
		minHeight: 560,
		title: "Librecord",
		backgroundColor: "#1e1f22",
		show: false,
		webPreferences: {
			preload: join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false
		}
	});
	mainWindow.on("ready-to-show", () => {
		mainWindow?.show();
	});
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: "deny" };
	});
	if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
	else mainWindow.loadFile(join(__dirname, "../dist/index.html"));
}
app.whenReady().then(() => {
	createWindow();
	initUpdater();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
//#endregion
