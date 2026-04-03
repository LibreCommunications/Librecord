interface ImportMetaEnv {
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly VITE_API_URL: string;
    readonly VITE_LIVEKIT_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

interface Window {
    electronAPI?: {
        platform: string;
        versions: {
            electron: string;
            chrome: string;
            node: string;
        };
        onUpdateAvailable: (callback: (version: string) => void) => void;
        onUpdateDownloaded: (callback: (version: string) => void) => void;
    };
}
