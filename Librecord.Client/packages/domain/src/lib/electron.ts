export interface ScreenShareSource {
    id: string;
    name: string;
    thumbnailDataUrl: string;
    displayId: string;
    appIconDataUrl: string | null;
}

export interface ElectronAPI {
    platform: string;
    versions: {
        electron: string;
        chrome: string;
        node: string;
    };
    getAppVersion: () => Promise<string>;
    onUpdateAvailable: (callback: (version: string) => void) => () => void;
    onUpdateDownloaded: (callback: (version: string) => void) => () => void;
    onUpdateInstalled: (callback: (version: string) => void) => () => void;
    getAutostart: () => Promise<boolean>;
    setAutostart: (enabled: boolean) => Promise<boolean>;
    getMinimizeToTray: () => Promise<boolean>;
    setMinimizeToTray: (enabled: boolean) => Promise<boolean>;
    showNotification: (opts: { title: string; body: string; channelId?: string }) => Promise<void>;
    onNavigate: (callback: (channelId: string) => void) => () => void;
    onDeepLink: (callback: (link: { type: string; params: string[] }) => void) => () => void;
    onScreenSharePick: (callback: (sources: ScreenShareSource[]) => void) => () => void;
    selectScreenShareSource: (sourceId: string) => void;
    cancelScreenSharePick: () => void;
    onQuitting: (callback: () => void) => () => void;
}

/** Returns the Electron API if running in the desktop app, undefined otherwise. */
export function getElectronAPI(): ElectronAPI | undefined {
    return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
}

/** Whether the app is running in the Electron desktop shell. */
export const isDesktop = typeof window !== "undefined" && !!(window as unknown as { electronAPI?: ElectronAPI }).electronAPI;

/** Pipecap API exposed on window.pipecap (Linux only). */
export interface PipecapAPI {
    available: () => Promise<boolean>;
    showPicker: (sourceTypes?: number) => Promise<{ streams: Array<{ nodeId: number; sourceType: number; width: number; height: number }>; pipewireFd: number } | null>;
    startCapture: (options: { nodeId: number; pipewireFd: number; fps: number; audio: boolean; sourceType: number }) => Promise<{ shmPath: string; shmSize: number; headerSize: number; width: number; height: number; detectedApp?: string } | false>;
    stopCapture: () => Promise<void>;
    isCapturing: () => Promise<boolean>;
    onFrame: (callback: (frame: { width: number; height: number; data: ArrayBuffer }) => void) => () => void;
    onAudio: (callback: (audio: { channels: number; sampleRate: number; data: Buffer }) => void) => () => void;
}

/** Returns the pipecap API if available (Linux desktop only), undefined otherwise. */
export function getPipecapAPI(): PipecapAPI | undefined {
    return (window as unknown as { pipecap?: PipecapAPI }).pipecap;
}

/** Shared memory frame reader for pipecap video (Linux only). */
export interface PipecapShmAPI {
    open: (shmPath: string) => boolean;
    readFrame: () => { width: number; height: number; data: ArrayBuffer } | null;
    close: () => void;
}

/** Returns the pipecap shm reader if available (Linux desktop only). */
export function getPipecapShmAPI(): PipecapShmAPI | undefined {
    return (window as unknown as { pipecapShm?: PipecapShmAPI }).pipecapShm;
}
