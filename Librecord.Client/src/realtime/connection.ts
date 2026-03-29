import * as signalR from "@microsoft/signalr";
import { registerListeners } from "./listeners";
import { getVoiceState, getVoicePrefs, resetVoiceState } from "../voice/voiceStore";
import * as livekitClient from "../voice/livekitClient";
import { logger } from "../lib/logger";

const API_URL = import.meta.env.VITE_API_URL;

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

let _state: ConnectionState = "disconnected";
const _stateListeners: Set<() => void> = new Set();

export function getConnectionState(): ConnectionState { return _state; }

export function subscribeConnectionState(cb: () => void): () => void {
    _stateListeners.add(cb);
    return () => { _stateListeners.delete(cb); };
}

export function setConnectionState(s: ConnectionState) {
    _state = s;
    _stateListeners.forEach(cb => cb());
}

// Keep retrying for up to 5 minutes with exponential backoff (capped at 15s).
// The default fixed array gives up after ~48s which is too short for CI deploys.
const reconnectPolicy: signalR.IRetryPolicy = {
    nextRetryDelayInMilliseconds(retryContext) {
        const elapsed = retryContext.elapsedMilliseconds;
        if (elapsed > 5 * 60_000) return null; // give up after 5 minutes
        return Math.min(1000 * Math.pow(1.5, retryContext.previousRetryCount), 15_000);
    },
};

export const appConnection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_URL}/hubs/app`, { withCredentials: true })
    .withAutomaticReconnect(reconnectPolicy)
    .build();

appConnection.keepAliveIntervalInMilliseconds = 10_000;
appConnection.serverTimeoutInMilliseconds = 60_000;

appConnection.onreconnected(async () => {
    registerListeners();
    setConnectionState("connected");

    const voice = getVoiceState();
    if (voice.isConnected && voice.channelId) {
        const prefs = getVoicePrefs();
        try {
            await appConnection.invoke("RejoinVoiceChannel", voice.channelId, {
                isMuted: prefs.isMuted,
                isDeafened: prefs.isDeafened,
                isCameraOn: voice.isCameraOn,
                isScreenSharing: voice.isScreenSharing,
            });
        } catch (e) {
            logger.realtime.warn("Failed to rejoin voice channel", e);
        }
    }

    window.dispatchEvent(new Event("realtime:reconnected"));
});

appConnection.onreconnecting(err => {
    logger.realtime.warn("Reconnecting...", err?.message);
    setConnectionState("reconnecting");
});

// All retry attempts exhausted. If we're in a voice call, try one more
// fresh connection before nuking state — LiveKit media is still flowing.
appConnection.onclose(async (err) => {
    logger.realtime.warn("Connection closed", err?.message);

    const wasInVoice = getVoiceState().isConnected;

    if (wasInVoice) {
        logger.realtime.info("Was in voice call — attempting fresh connection...");
        setConnectionState("reconnecting");
        try {
            await appConnection.start();
            registerListeners();
            setConnectionState("connected");

            const voice = getVoiceState();
            if (voice.channelId) {
                const prefs = getVoicePrefs();
                await appConnection.invoke("RejoinVoiceChannel", voice.channelId, {
                    isMuted: prefs.isMuted,
                    isDeafened: prefs.isDeafened,
                    isCameraOn: voice.isCameraOn,
                    isScreenSharing: voice.isScreenSharing,
                });
            }

            window.dispatchEvent(new Event("realtime:reconnected"));
            return;
        } catch (e) {
            logger.realtime.warn("Fresh connection failed", e);
        }
    }

    setConnectionState("disconnected");
    livekitClient.disconnect().catch(e => logger.realtime.warn("Disconnect cleanup failed", e));
    resetVoiceState();
});
