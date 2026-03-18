import * as signalR from "@microsoft/signalr";

const API_URL = import.meta.env.VITE_API_URL;

export const dmConnection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_URL}/hubs/dms`, { withCredentials: true })
    .withAutomaticReconnect()
    .build();
