import * as signalR from "@microsoft/signalr";
import { registerDmListeners } from "./dmListeners";

const API_URL = import.meta.env.VITE_API_URL;

export const dmConnection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_URL}/hubs/dms`, { withCredentials: true })
    .withAutomaticReconnect([0, 1000, 2000, 5000, 10000, 30000])
    .build();

// Match server's 10s keepalive interval; allow 60s before considering server dead
// (gives Cloudflare proxy time to re-establish the connection)
dmConnection.keepAliveIntervalInMilliseconds = 10_000;
dmConnection.serverTimeoutInMilliseconds = 60_000;

dmConnection.onreconnected(() => {
    registerDmListeners();
});

dmConnection.onreconnecting(err => {
    console.warn("[Realtime] DM reconnecting...", err?.message);
});

dmConnection.onclose(err => {
    console.warn("[Realtime] DM connection closed", err?.message);
});
