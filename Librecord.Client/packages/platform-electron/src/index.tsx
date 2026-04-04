import { useMemo } from "react";
import { PlatformContext, type Platform } from "@librecord/platform";
import {
    webStorage,
    webSessionStorage,
    webEventBus,
    webHttpClient,
    webAudio,
    webUUID,
    webLifecycle,
} from "@librecord/platform-web";
import { electronNotifications } from "./notifications.ts";

export function ElectronPlatformProvider({ children }: { children: React.ReactNode }) {
    const platform = useMemo<Platform>(() => ({
        storage: webStorage,
        sessionStorage: webSessionStorage,
        events: webEventBus,
        http: webHttpClient,
        notifications: electronNotifications,
        audio: webAudio,
        uuid: webUUID,
        lifecycle: webLifecycle,
    }), []);

    return (
        <PlatformContext.Provider value={platform}>
            {children}
        </PlatformContext.Provider>
    );
}
