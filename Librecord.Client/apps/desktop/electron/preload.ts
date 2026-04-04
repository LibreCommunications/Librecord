import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  onUpdateAvailable: (callback: (version: string) => void) => {
    ipcRenderer.on("update-available", (_event, version) => callback(version));
  },
  onUpdateDownloaded: (callback: (version: string) => void) => {
    ipcRenderer.on("update-downloaded", (_event, version) => callback(version));
  },

  // Desktop settings
  getAutostart: (): Promise<boolean> => ipcRenderer.invoke("desktop:getAutostart"),
  setAutostart: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke("desktop:setAutostart", enabled),
  getMinimizeToTray: (): Promise<boolean> => ipcRenderer.invoke("desktop:getMinimizeToTray"),
  setMinimizeToTray: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke("desktop:setMinimizeToTray", enabled),
});
