import * as signalR from "@microsoft/signalr";

const API_URL = import.meta.env.VITE_API_URL;

export const guildConnection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_URL}/hubs/guilds`, { withCredentials: true })
    .withAutomaticReconnect()
    .build();
