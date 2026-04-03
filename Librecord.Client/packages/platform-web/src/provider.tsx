import { useMemo } from "react";
import { PlatformContext, type Platform } from "@librecord/platform";
import { webStorage, webSessionStorage } from "./storage.ts";
import { webEventBus } from "./events.ts";
import { webHttpClient } from "./http.ts";
import { webNotifications } from "./notifications.ts";
import { webAudio } from "./audio.ts";
import { webUUID } from "./uuid.ts";
import { webLifecycle } from "./lifecycle.ts";

export function WebPlatformProvider({ children }: { children: React.ReactNode }) {
    const platform = useMemo<Platform>(() => ({
        storage: webStorage,
        sessionStorage: webSessionStorage,
        events: webEventBus,
        http: webHttpClient,
        notifications: webNotifications,
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
