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

  // Native notifications (#105)
  showNotification: (opts: { title: string; body: string; channelId?: string }): Promise<void> =>
    ipcRenderer.invoke("desktop:showNotification", opts),
  onNavigate: (callback: (channelId: string) => void) => {
    ipcRenderer.on("navigate", (_event, channelId) => callback(channelId));
  },

  // Deep linking (#109)
  onDeepLink: (callback: (link: { type: string; params: string[] }) => void) => {
    ipcRenderer.on("deep-link", (_event, link) => callback(link));
  },
});
