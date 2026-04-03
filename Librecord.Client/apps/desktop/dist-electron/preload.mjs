let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("electronAPI", {
	platform: process.platform,
	versions: {
		electron: process.versions.electron,
		chrome: process.versions.chrome,
		node: process.versions.node
	},
	onUpdateAvailable: (callback) => {
		electron.ipcRenderer.on("update-available", (_event, version) => callback(version));
	},
	onUpdateDownloaded: (callback) => {
		electron.ipcRenderer.on("update-downloaded", (_event, version) => callback(version));
	}
});
//#endregion
