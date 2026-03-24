import * as signalR from "@microsoft/signalr";
import { registerGuildListeners } from "./guildListeners";
import { resetVoiceState } from "../../voice/voiceStore";
import * as livekitClient from "../../voice/livekitClient";

const API_URL = import.meta.env.VITE_API_URL;

export const guildConnection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_URL}/hubs/guilds`, { withCredentials: true })
    .withAutomaticReconnect([0, 1000, 2000, 5000, 10000, 30000])
    .build();

// Match server's 10s keepalive interval; allow 60s before considering server dead
guildConnection.keepAliveIntervalInMilliseconds = 10_000;
guildConnection.serverTimeoutInMilliseconds = 60_000;

guildConnection.onreconnected(() => {
    registerGuildListeners();
});

guildConnection.onreconnecting(err => {
    console.warn("[Realtime] Guild reconnecting...", err?.message);
});

guildConnection.onclose(err => {
    console.warn("[Realtime] Guild connection closed", err?.message);
    // Voice is dead if guild connection drops — clean up
    livekitClient.disconnect().catch(() => {});
    resetVoiceState();
});
