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
    venmicAvailable: () => Promise<boolean>;
    venmicStart: () => Promise<boolean>;
    venmicStop: () => Promise<void>;
}

/** Returns the Electron API if running in the desktop app, undefined otherwise. */
export function getElectronAPI(): ElectronAPI | undefined {
    return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
}

/** Whether the app is running in the Electron desktop shell. */
export const isDesktop = typeof window !== "undefined" && !!(window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
