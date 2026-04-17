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
    /** Returns the version of any already-downloaded pending update, or
     * null if none. Use on renderer mount to catch updates that finished
     * downloading before the renderer was ready to listen. */
    getPendingUpdate: () => Promise<string | null>;
    /** Returns the last update error message if any — useful for surfacing
     * "Update check failed" in settings. */
    getUpdateError: () => Promise<string | null>;
    /** Manually trigger a check for updates. Returns whether an update
     * is available and whether it's already downloaded. */
    checkForUpdate: () => Promise<{
        ok: boolean;
        hasUpdate?: boolean;
        version?: string;
        downloaded?: boolean;
        reason?: string;
    }>;
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

// ── WinAudio (Windows WASAPI loopback) ───────────────────────────

export interface WinAudioCapabilities {
    /** Whether Win11 22000+ per-process loopback is available. */
    processLoopback: boolean;
    windowsBuild: number;
}

export interface WinAudioChunk {
    /** QPC ns as BigInt-as-string. */
    timestampNs: string;
    frameCount: number;
    sampleRate: number;
    channels: number;
    /** Interleaved float32 samples. */
    data: Uint8Array;
}

/** WinAudio API exposed on window.winaudio (Windows only).
 *
 *  Video capture on Windows is handled by Chromium's getDisplayMedia
 *  (single hardware encode, no IPC readback). This bridge only provides
 *  WASAPI loopback audio — something Chromium can't do per-process on
 *  Windows, which is required so the Librecord voice call doesn't loop
 *  back to remote participants as echo. */
export interface WinAudioAPI {
    available: () => Promise<boolean>;
    getCapabilities: () => Promise<WinAudioCapabilities>;

    /** Start a WASAPI loopback audio capture session.
     *  systemLoopback = whole-device mix; processLoopback = a specific
     *  PID's output (Win11 22000+ only). If no options, the main
     *  process auto-selects processLoopback-excluding-Librecord on
     *  Win11, systemLoopback otherwise. */
    startAudio: (options?: { mode?: "systemLoopback" | "processLoopback"; pid?: number }) => Promise<boolean>;
    stopAudio: () => Promise<void>;

    onAudio: (callback: (chunk: WinAudioChunk) => void) => () => void;
    onAudioError: (callback: (err: unknown) => void) => () => void;
}

/** Returns the winaudio API if available (Windows desktop only). */
export function getWinAudioAPI(): WinAudioAPI | undefined {
    return (window as unknown as { winaudio?: WinAudioAPI }).winaudio;
}
