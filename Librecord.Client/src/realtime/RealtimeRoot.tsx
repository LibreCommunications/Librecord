import { useEffect, useRef } from "react";
import { dmConnection } from "./dm/dmConnection";
import { registerDmListeners } from "./dm/dmListeners";
import { guildConnection } from "./guild/guildConnection";
import { registerGuildListeners } from "./guild/guildListeners";
import { initNotifications } from "./notifications";
import { useAuth } from "../context/AuthContext";

/**
 * Global realtime bootstrap
 *
 * Mounted ONCE for the entire app.
 * Handles:
 *  - DM realtime
 *  - Guild realtime
 *  - Browser notifications + sound
 */
export function RealtimeRoot() {
    const started = useRef(false);
    const { user } = useAuth();

    useEffect(() => {
        if (started.current) return;
        started.current = true;

        // Initialize browser notifications
        if (user?.userId) {
            initNotifications(user.userId);
        }

        dmConnection
            .start()
            .then(() => {
                console.log("[Realtime] DM connected");
                registerDmListeners();
            })
            .catch(err => {
                console.error("[Realtime] DM connection failed", err);
            });

        guildConnection
            .start()
            .then(() => {
                console.log("[Realtime] Guild connected");
                registerGuildListeners();
            })
            .catch(err => {
                console.error("[Realtime] Guild connection failed", err);
            });
    }, []);

    return null;
}
