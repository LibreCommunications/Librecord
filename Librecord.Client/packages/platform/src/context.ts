import { createContext, useContext } from "react";
import type { StorageAdapter, SessionStorageAdapter } from "./storage.ts";
import type { EventBus } from "./events.ts";
import type { HttpClient } from "./http.ts";
import type { NotificationService } from "./notifications.ts";
import type { AudioService } from "./audio.ts";
import type { UUIDGenerator } from "./uuid.ts";
import type { LifecycleService } from "./lifecycle.ts";

export interface Platform {
    storage: StorageAdapter;
    sessionStorage: SessionStorageAdapter;
    events: EventBus;
    http: HttpClient;
    notifications: NotificationService;
    audio: AudioService;
    uuid: UUIDGenerator;
    lifecycle: LifecycleService;
}

export const PlatformContext = createContext<Platform>(null!);

export function usePlatform(): Platform {
    return useContext(PlatformContext);
}
