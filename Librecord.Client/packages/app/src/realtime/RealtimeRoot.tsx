import { useEffect, useRef } from "react";
import { appConnection, setConnectionState } from "@librecord/api-client";
import { registerListeners } from "./listeners";
import { initNotifications, cleanupNotifications } from "./notifications";
import { initCacheInvalidation } from "../cacheInvalidation";
import { resetVoiceState, getPersistedVoiceSession, clearPersistedVoiceSession, setVoiceState, getVoicePrefs } from "../voice/voiceStore";
import { logger } from "@librecord/domain";
import * as livekitClient from "../voice/livekitClient";
import { useAuth } from "../hooks/useAuth";
import { usePlatform } from "@librecord/platform";
import { STORAGE } from "@librecord/domain";
import type { VoiceParticipant } from "../voice/voiceStore";

declare global {
    interface Window {
        __realtimeReady?: boolean;
    }
}

// Module-level flag — survives React StrictMode double-mount
let started = false;

async function tryRestoreVoiceSession() {
    const session = getPersistedVoiceSession();
    if (!session) return;

    const prefs = getVoicePrefs();

    try {
        // Try rejoin first (server may still have our voice state row)
        let result = await appConnection.invoke<{
            token: string;
            wsUrl: string;
            participants: VoiceParticipant[];
        } | null>("RejoinVoiceChannel", session.channelId, {
            isMuted: prefs.isMuted,
            isDeafened: prefs.isDeafened,
            isCameraOn: false,
            isScreenSharing: false,
        });

        // RejoinVoiceChannel returns null when the row survived (just updated flags).
        // We still need a fresh token, so do a full rejoin via the correct method.
        if (!result) {
            const method = session.guildId ? "JoinVoiceChannel" : "AcceptDmCall";
            result = await appConnection.invoke<{
                token: string;
                wsUrl: string;
                participants: VoiceParticipant[];
            }>(method, session.channelId);
        }

        setVoiceState({
            channelId: session.channelId,
            guildId: session.guildId,
            participants: result.participants,
            isConnected: true,
            isMuted: prefs.isMuted,
            isDeafened: prefs.isDeafened,
            isCameraOn: false,
            isScreenSharing: false,
        });

        await livekitClient.connectToVoice(result.token, result.wsUrl, prefs.isMuted, prefs.isDeafened);

        if (prefs.isMuted || prefs.isDeafened) {
            appConnection.invoke("UpdateVoiceState", {
                isMuted: prefs.isMuted,
                isDeafened: prefs.isDeafened,
            }).catch(e => logger.realtime.warn("Failed to sync voice state", e));
        }
    } catch (e) {
        logger.realtime.warn("Failed to restore voice session", e);
        clearPersistedVoiceSession();
    }
}

function restoreReturnUrl() {
    const returnUrl = sessionStorage.getItem(STORAGE.returnUrl);
    if (returnUrl) {
        sessionStorage.removeItem(STORAGE.returnUrl);
        if (returnUrl !== window.location.pathname) {
            window.history.replaceState(null, "", returnUrl);
        }
    }
}

export function RealtimeRoot() {
    const { user } = useAuth();
    const { notifications } = usePlatform();
    const userIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!user?.userId || started) return;
        started = true;
        userIdRef.current = user.userId;

        initNotifications(user.userId, notifications);

        setConnectionState("connecting");
        appConnection.start().then(async () => {
            registerListeners();
            initCacheInvalidation();
            setConnectionState("connected");
            window.__realtimeReady = true;
            window.dispatchEvent(new Event("realtime:ready"));

            restoreReturnUrl();
            await tryRestoreVoiceSession();

            // Trigger re-fetch of voice participants and presence now that
            // the connection is established and voice session is restored.
            window.dispatchEvent(new Event("realtime:reconnected"));
        }).catch(err => {
            logger.realtime.error("Connection failed", err);
            setConnectionState("disconnected");
        });
    });

    useEffect(() => {
        if (user?.userId) {
            userIdRef.current = user.userId;
            return;
        }
        if (!user && userIdRef.current) {
            userIdRef.current = null;
            started = false;
            window.__realtimeReady = false;

            cleanupNotifications();
            livekitClient.disconnect().catch(e => logger.realtime.warn("Disconnect cleanup failed", e));
            resetVoiceState();
            appConnection.stop().catch(e => logger.realtime.warn("Connection stop failed", e));
        }
    }, [user]);

    return null;
}
