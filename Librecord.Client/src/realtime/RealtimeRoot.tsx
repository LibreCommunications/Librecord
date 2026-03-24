import { useEffect, useRef } from "react";
import { appConnection, setConnectionState } from "./connection";
import { registerListeners } from "./listeners";
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

    // Start connection once when user is available
    useEffect(() => {
        if (!user?.userId || started) return;
        started = true;
        userIdRef.current = user.userId;

        initNotifications(user.userId);

        setConnectionState("connecting");
        appConnection.start().then(() => {
            registerListeners();
            setConnectionState("connected");
            window.__realtimeReady = true;
            window.dispatchEvent(new Event("realtime:ready"));
        }).catch(err => {
            console.error("[Realtime] Connection failed", err);
            setConnectionState("disconnected");
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
            appConnection.stop().catch(() => {});
        }
    }, [user]);

    return null;
}
