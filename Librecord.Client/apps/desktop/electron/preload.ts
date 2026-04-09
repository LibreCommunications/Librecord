import { contextBridge, ipcRenderer } from "electron";
import * as fs from "fs";

// Expose pipecap API on Linux (window.pipecap + window.pipecapShm)
if (process.platform === "linux") {
  contextBridge.exposeInMainWorld("pipecap", {
    available: () => ipcRenderer.invoke("pipecap:available"),
    showPicker: (sourceTypes?: number) => ipcRenderer.invoke("pipecap:showPicker", sourceTypes),
    startCapture: (options: Record<string, unknown>) => ipcRenderer.invoke("pipecap:startCapture", options),
    stopCapture: () => ipcRenderer.invoke("pipecap:stopCapture"),
    isCapturing: () => ipcRenderer.invoke("pipecap:isCapturing"),
    listAudioApps: () => ipcRenderer.invoke("pipecap:listAudioApps"),
    setAudioTarget: (target: string) => ipcRenderer.invoke("pipecap:setAudioTarget", target),
    onAudio: (callback: (audio: { channels: number; sampleRate: number; data: Buffer }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, audio: { channels: number; sampleRate: number; data: Buffer }) => callback(audio);
      ipcRenderer.on("pipecap:audio", handler);
      return () => ipcRenderer.removeListener("pipecap:audio", handler);
    },
  });

  // Expose shared memory frame reader for zero-copy video frames.
  // pipecap writes frames to /dev/shm/pipecap-frames-<pid> (the path is
  // returned in captureInfo.shmPath); we read them directly from the
  // preload (Node.js access) to avoid IPC copying.
  let shmFd: number | null = null;
  let lastSeq = BigInt(0);

  contextBridge.exposeInMainWorld("pipecapShm", {
    open: (shmPath: string) => {
      try {
        shmFd = fs.openSync(shmPath, "r");
        lastSeq = BigInt(0);
        return true;
      } catch {
        return false;
      }
    },
    readFrame: (): { width: number; height: number; stride: number; data: ArrayBuffer } | null => {
      if (shmFd === null) return null;
      // Header layout (from pipecap shm.rs):
      //   seq: u64 (offset 0), width: u32 (8), height: u32 (12),
      //   stride: u32 (16), data_offset: u32 (20), data_size: u32 (24)
      const headerBuf = Buffer.alloc(32);
      fs.readSync(shmFd, headerBuf, 0, 32, 0);
      const seq = headerBuf.readBigUInt64LE(0);
      if (seq === lastSeq) return null; // No new frame
      lastSeq = seq;
      const width = headerBuf.readUInt32LE(8);
      const height = headerBuf.readUInt32LE(12);
      const stride = headerBuf.readUInt32LE(16);
      const dataOffset = headerBuf.readUInt32LE(20);
      const dataSize = headerBuf.readUInt32LE(24);
      if (width === 0 || height === 0 || dataSize === 0) return null;
      const frameBuf = Buffer.alloc(dataSize);
      fs.readSync(shmFd, frameBuf, 0, dataSize, dataOffset);
      return {
        width,
        height,
        stride,
        data: frameBuf.buffer.slice(frameBuf.byteOffset, frameBuf.byteOffset + frameBuf.byteLength),
      };
    },
    close: () => {
      if (shmFd !== null) {
        try { fs.closeSync(shmFd); } catch { /* ignore */ }
        shmFd = null;
      }
    },
  });
}

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

  // Screen share source picker (#122)
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
