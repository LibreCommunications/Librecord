import * as signalR from "@microsoft/signalr";
import { registerListeners } from "./listeners";
import { resetVoiceState } from "../voice/voiceStore";
import * as livekitClient from "../voice/livekitClient";

const API_URL = import.meta.env.VITE_API_URL;

export const appConnection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_URL}/hubs/app`, { withCredentials: true })
    .withAutomaticReconnect([0, 1000, 2000, 5000, 10000, 30000])
    .build();

appConnection.keepAliveIntervalInMilliseconds = 10_000;
appConnection.serverTimeoutInMilliseconds = 60_000;

appConnection.onreconnected(() => {
    registerListeners();
});

appConnection.onreconnecting(err => {
    console.warn("[Realtime] Reconnecting...", err?.message);
});

appConnection.onclose(err => {
    console.warn("[Realtime] Connection closed", err?.message);
    livekitClient.disconnect().catch(() => {});
    resetVoiceState();
});
