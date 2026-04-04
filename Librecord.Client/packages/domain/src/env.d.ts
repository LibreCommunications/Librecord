interface ImportMetaEnv {
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly BASE_URL: string;
    readonly VITE_API_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

interface ElectronAPI {
    platform: string;
    versions: {
        electron: string;
        chrome: string;
        node: string;
    };
    onUpdateAvailable: (callback: (version: string) => void) => void;
    onUpdateDownloaded: (callback: (version: string) => void) => void;
    getAutostart: () => Promise<boolean>;
    setAutostart: (enabled: boolean) => Promise<boolean>;
    getMinimizeToTray: () => Promise<boolean>;
    setMinimizeToTray: (enabled: boolean) => Promise<boolean>;
    showNotification: (opts: { title: string; body: string; channelId?: string }) => Promise<void>;
    onNavigate: (callback: (channelId: string) => void) => void;
    onDeepLink: (callback: (link: { type: string; params: string[] }) => void) => void;
}

interface Window {
    electronAPI?: ElectronAPI;
}
