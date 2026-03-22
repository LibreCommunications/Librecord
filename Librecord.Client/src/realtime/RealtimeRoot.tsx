import { useEffect, useRef } from "react";
import { dmConnection } from "./dm/dmConnection";
import { registerDmListeners } from "./dm/dmListeners";
import { guildConnection } from "./guild/guildConnection";
import { registerGuildListeners } from "./guild/guildListeners";
import { initNotifications, cleanupNotifications } from "./notifications";
import { resetVoiceState } from "../voice/voiceStore";
import * as livekitClient from "../voice/livekitClient";
import { useAuth } from "../hooks/useAuth";

declare global {
    interface Window {
        __realtimeReady?: boolean;
    }
}

// Module-level flag — survives React StrictMode double-mount
let started = false;

export function RealtimeRoot() {
    const { user } = useAuth();
    const userIdRef = useRef<string | null>(null);

    // Start connections once when user is available
    useEffect(() => {
        if (!user?.userId || started) return;
        started = true;
        userIdRef.current = user.userId;

        initNotifications(user.userId);

        Promise.all([
            dmConnection.start().then(() => {
                // DM connected
                registerDmListeners();
            }).catch(err => console.error("[Realtime] DM connection failed", err)),

            guildConnection.start().then(() => {
                // Guild connected
                registerGuildListeners();
            }).catch(err => console.error("[Realtime] Guild connection failed", err)),
        ]).then(() => {
            window.__realtimeReady = true;
            window.dispatchEvent(new Event("realtime:ready"));
        });
    });

    // Detect logout — user was set, now null
    useEffect(() => {
        if (user?.userId) {
            userIdRef.current = user.userId;
            return;
        }
        if (!user && userIdRef.current) {
            // User logged out
            userIdRef.current = null;
            started = false;
            window.__realtimeReady = false;

            cleanupNotifications();
            livekitClient.disconnect().catch(() => {});
            resetVoiceState();
            dmConnection.stop().catch(() => {});
            guildConnection.stop().catch(() => {});
            // Connections stopped
        }
    }, [user]);

    return null;
}
