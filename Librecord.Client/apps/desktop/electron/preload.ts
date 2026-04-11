import { contextBridge, ipcRenderer } from "electron";
import { exposePlatformBridges } from "./preload-platform";

// Per-platform native bridges (window.pipecap on Linux, window.wincap on
// Windows, etc). Kept in their own modules so the dispatcher and the
// shared electronAPI surface below stay readable.
exposePlatformBridges();

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("desktop:getAppVersion"),
  onUpdateAvailable: (callback: (version: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, version: string) => callback(version);
    ipcRenderer.on("update-available", handler);
    return () => { ipcRenderer.removeListener("update-available", handler); };
  },
  onUpdateDownloaded: (callback: (version: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, version: string) => callback(version);
    ipcRenderer.on("update-downloaded", handler);
    return () => { ipcRenderer.removeListener("update-downloaded", handler); };
  },
  onUpdateInstalled: (callback: (version: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, version: string) => callback(version);
    ipcRenderer.on("update-installed", handler);
    return () => { ipcRenderer.removeListener("update-installed", handler); };
  },
  installUpdateNow: (): Promise<void> => ipcRenderer.invoke("desktop:installUpdateNow"),

  // Desktop settings
  getAutostart: (): Promise<boolean> => ipcRenderer.invoke("desktop:getAutostart"),
  setAutostart: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke("desktop:setAutostart", enabled),
  getMinimizeToTray: (): Promise<boolean> => ipcRenderer.invoke("desktop:getMinimizeToTray"),
  setMinimizeToTray: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke("desktop:setMinimizeToTray", enabled),

  // Native notifications (#105)
  showNotification: (opts: { title: string; body: string; channelId?: string }): Promise<void> =>
    ipcRenderer.invoke("desktop:showNotification", opts),
  onNavigate: (callback: (channelId: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, channelId: string) => callback(channelId);
    ipcRenderer.on("navigate", handler);
    return () => { ipcRenderer.removeListener("navigate", handler); };
  },

  // Deep linking (#109)
  onDeepLink: (callback: (link: { type: string; params: string[] }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, link: { type: string; params: string[] }) => callback(link);
    ipcRenderer.on("deep-link", handler);
    return () => { ipcRenderer.removeListener("deep-link", handler); };
  },

  // Screen share source picker (#122) — shared event channel; both the
  // desktopCapturer fallback (main.ts) and the wincap picker (win32.ts)
  // emit `screen-share-pick` and listen on `screen-share-selected`.
  onScreenSharePick: (callback: (sources: Array<{
    id: string;
    name: string;
    thumbnailDataUrl: string;
    displayId: string;
    appIconDataUrl: string | null;
  }>) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, sources: Array<{
      id: string; name: string; thumbnailDataUrl: string;
      displayId: string; appIconDataUrl: string | null;
    }>) => callback(sources);
    ipcRenderer.on("screen-share-pick", handler);
    return () => { ipcRenderer.removeListener("screen-share-pick", handler); };
  },
  selectScreenShareSource: (sourceId: string) => {
    ipcRenderer.send("screen-share-selected", sourceId);
  },
  cancelScreenSharePick: () => {
    ipcRenderer.send("screen-share-cancelled");
  },

  // App lifecycle
  onQuitting: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("app-quitting", handler);
    return () => { ipcRenderer.removeListener("app-quitting", handler); };
  },
});
