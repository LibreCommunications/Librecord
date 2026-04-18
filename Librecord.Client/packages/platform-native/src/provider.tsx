import { useMemo } from "react";
import { PlatformContext, type Platform } from "@librecord/platform";
import { nativeStorage, nativeSessionStorage } from "./storage.ts";
import { nativeEventBus } from "./events.ts";
import { nativeHttpClient } from "./http.ts";
import { nativeNotifications } from "./notifications.ts";
import { nativeAudio } from "./audio.ts";
import { nativeUUID } from "./uuid.ts";
import { nativeLifecycle } from "./lifecycle.ts";

export function NativePlatformProvider({ children }: { children: React.ReactNode }) {
    const platform = useMemo<Platform>(() => ({
        storage: nativeStorage,
        sessionStorage: nativeSessionStorage,
        events: nativeEventBus,
        http: nativeHttpClient,
        notifications: nativeNotifications,
        audio: nativeAudio,
        uuid: nativeUUID,
        lifecycle: nativeLifecycle,
    }), []);

    return (
        <PlatformContext.Provider value={platform}>
            {children}
        </PlatformContext.Provider>
    );
}
