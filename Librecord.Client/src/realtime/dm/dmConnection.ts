import * as signalR from "@microsoft/signalr";
import { registerDmListeners } from "./dmListeners";

const API_URL = import.meta.env.VITE_API_URL;

export const dmConnection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_URL}/hubs/dms`, { withCredentials: true })
    .withAutomaticReconnect([0, 1000, 2000, 5000, 10000, 30000])
    .build();

dmConnection.onreconnected(() => {
    console.log("[Realtime] DM reconnected");
    registerDmListeners();
});

dmConnection.onreconnecting(err => {
    console.warn("[Realtime] DM reconnecting...", err?.message);
});

dmConnection.onclose(err => {
    console.warn("[Realtime] DM connection closed", err?.message);
});
