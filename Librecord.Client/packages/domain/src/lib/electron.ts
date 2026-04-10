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
    /** Tell the main process to quit and install a previously-downloaded
     * update. Triggered by the in-app update modal's "Restart now" button. */
    installUpdateNow: () => Promise<void>;
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

export interface AudioAppInfo {
    name: string;
    binary: string;
}

/** Pipecap API exposed on window.pipecap (Linux only). */
export interface PipecapAPI {
    available: () => Promise<boolean>;
    /** Show the native portal picker. The returned PipeWire fd is held inside
     * the main process — the renderer never sees it. */
    showPicker: (sourceTypes?: number) => Promise<{ streams: Array<{ nodeId: number; sourceType: number; width: number; height: number }> } | null>;
    /** Start capture. The Electron main process automatically injects the
     * full set of host PIDs as `excludePids` so we never hear ourselves in
     * the share — callers do not need to set it. */
    startCapture: (options: { nodeId: number; fps: number; audio: boolean; sourceType: number }) => Promise<{ shmPath: string; shmSize: number; headerSize: number; width: number; height: number; detectedApp?: string } | false>;
    stopCapture: () => Promise<void>;
    isCapturing: () => Promise<boolean>;
    listAudioApps: () => Promise<AudioAppInfo[]>;
    setAudioTarget: (target: string) => Promise<void>;
    onAudio: (callback: (audio: { channels: number; sampleRate: number; data: Uint8Array }) => void) => () => void;
}

/** Returns the pipecap API if available (Linux desktop only), undefined otherwise. */
export function getPipecapAPI(): PipecapAPI | undefined {
    return (window as unknown as { pipecap?: PipecapAPI }).pipecap;
}

/** Shared memory frame reader for pipecap video (Linux only). */
export interface PipecapShmAPI {
    open: (shmPath: string) => boolean;
    readFrame: () => { width: number; height: number; stride: number; data: ArrayBuffer } | null;
    close: () => void;
}

/** Returns the pipecap shm reader if available (Linux desktop only). */
export function getPipecapShmAPI(): PipecapShmAPI | undefined {
    return (window as unknown as { pipecapShm?: PipecapShmAPI }).pipecapShm;
}

// ── Wincap (Windows) ──────────────────────────────────────────────

export interface WincapDisplay {
    kind: "display";
    /** HMONITOR as string (BigInt isn't IPC-serialisable). */
    monitorHandle: string;
    name: string;
    primary: boolean;
    bounds: { x: number; y: number; width: number; height: number };
}

export interface WincapWindow {
    kind: "window";
    /** HWND as string. */
    hwnd: string;
    title: string;
    pid: number;
    bounds: { x: number; y: number; width: number; height: number };
}

export interface WincapCapabilities {
    wgc: boolean;
    wgcBorderOptional: boolean;
    processLoopback: boolean;
    windowsBuild: number;
}

export interface WincapEncodedFrame {
    data: Uint8Array;
    /** QPC nanoseconds, BigInt-as-string. */
    timestampNs: string;
    keyframe: boolean;
}

export interface WincapStartOptions {
    sourceKind: "display" | "window";
    /** HMONITOR or HWND as string. */
    handle: string;
    fps: number;
    bitrateBps: number;
    keyframeIntervalMs?: number;
    codec?: "h264" | "hevc" | "av1";
}

/** Wincap API exposed on window.wincap (Windows only). */
export interface WincapAPI {
    available: () => Promise<boolean>;
    getCapabilities: () => Promise<WincapCapabilities>;
    listSources: () => Promise<{ displays: WincapDisplay[]; windows: WincapWindow[] }>;
    startCapture: (options: WincapStartOptions) => Promise<boolean>;
    stopCapture: () => Promise<void>;
    requestKeyframe: () => Promise<void>;
    setBitrate: (bps: number) => Promise<void>;
    onEncoded: (callback: (frame: WincapEncodedFrame) => void) => () => void;
    onError: (callback: (err: { component: string; hresult: number; message: string }) => void) => () => void;
}

/** Returns the wincap API if available (Windows desktop only), undefined otherwise. */
export function getWincapAPI(): WincapAPI | undefined {
    return (window as unknown as { wincap?: WincapAPI }).wincap;
}
