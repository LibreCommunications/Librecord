import { useEffect, useRef } from "react";
import { appConnection, setConnectionState } from "./connection";
import { registerListeners } from "./listeners";
import { initNotifications, cleanupNotifications } from "./notifications";
import { resetVoiceState, getPersistedVoiceSession, clearPersistedVoiceSession, setVoiceState } from "../voice/voiceStore";
import * as livekitClient from "../voice/livekitClient";
import { useAuth } from "../hooks/useAuth";
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

    try {
        const result = await appConnection.invoke<{
            token: string;
            wsUrl: string;
            participants: VoiceParticipant[];
        } | null>("RejoinVoiceChannel", session.channelId, {
            isMuted: session.isMuted,
            isDeafened: session.isDeafened,
            isCameraOn: false,
            isScreenSharing: false,
        });

        if (result) {
            setVoiceState({
                channelId: session.channelId,
                guildId: session.guildId,
                participants: result.participants,
                isConnected: true,
                isMuted: session.isMuted,
                isDeafened: session.isDeafened,
                isCameraOn: false,
                isScreenSharing: false,
            });
            await livekitClient.connectToVoice(result.token, result.wsUrl);
        } else {
            // Row survived — just restore local state and reconnect LiveKit
            // RejoinVoiceChannel returned null meaning state was updated,
            // but we need a token. Do a full join instead.
            const fullResult = await appConnection.invoke<{
                token: string;
                wsUrl: string;
                participants: VoiceParticipant[];
            }>("JoinVoiceChannel", session.channelId);

            setVoiceState({
                channelId: session.channelId,
                guildId: session.guildId,
                participants: fullResult.participants,
                isConnected: true,
                isMuted: session.isMuted,
                isDeafened: session.isDeafened,
                isCameraOn: false,
                isScreenSharing: false,
            });
            await livekitClient.connectToVoice(fullResult.token, fullResult.wsUrl);
        }
    } catch (e) {
        console.warn("[Realtime] Failed to restore voice session:", e);
        clearPersistedVoiceSession();
    }
}

function restoreReturnUrl() {
    const returnUrl = sessionStorage.getItem("librecord:returnUrl");
    if (returnUrl) {
        sessionStorage.removeItem("librecord:returnUrl");
        if (returnUrl !== window.location.pathname) {
            window.history.replaceState(null, "", returnUrl);
        }
    }
}

export function RealtimeRoot() {
    const { user } = useAuth();
    const userIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!user?.userId || started) return;
        started = true;
        userIdRef.current = user.userId;

        initNotifications(user.userId);

        setConnectionState("connecting");
        appConnection.start().then(async () => {
            registerListeners();
            setConnectionState("connected");
            window.__realtimeReady = true;
            window.dispatchEvent(new Event("realtime:ready"));

            restoreReturnUrl();
            await tryRestoreVoiceSession();
        }).catch(err => {
            console.error("[Realtime] Connection failed", err);
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
            livekitClient.disconnect().catch(() => {});
            resetVoiceState();
            appConnection.stop().catch(() => {});
        }
    }, [user]);

    return null;
}
