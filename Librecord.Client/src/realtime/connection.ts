import * as signalR from "@microsoft/signalr";
import { registerListeners } from "./listeners";
import { resetVoiceState } from "../voice/voiceStore";
import * as livekitClient from "../voice/livekitClient";

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

export const appConnection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_URL}/hubs/app`, { withCredentials: true })
    .withAutomaticReconnect([0, 1000, 2000, 5000, 10000, 30000])
    .build();

appConnection.keepAliveIntervalInMilliseconds = 10_000;
appConnection.serverTimeoutInMilliseconds = 60_000;

appConnection.onreconnected(() => {
    registerListeners();
    setConnectionState("connected");
    window.dispatchEvent(new Event("realtime:reconnected"));
});

appConnection.onreconnecting(err => {
    console.warn("[Realtime] Reconnecting...", err?.message);
    setConnectionState("reconnecting");
});

appConnection.onclose(err => {
    console.warn("[Realtime] Connection closed", err?.message);
    setConnectionState("disconnected");
    livekitClient.disconnect().catch(() => {});
    resetVoiceState();
});
