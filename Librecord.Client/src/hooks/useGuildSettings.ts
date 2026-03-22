import { useCallback } from "react";
import { useAuth } from "./useAuth";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export function useGuildSettings() {
    const auth = useAuth();

    const updateGuild = useCallback(async (guildId: string, data: { name?: string }): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        }, auth);
        return res.ok;
    }, [auth]);

    const deleteGuild = useCallback(async (guildId: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}`, { method: "DELETE" }, auth);
        return res.ok;
    }, [auth]);

    const kickMember = useCallback(async (guildId: string, userId: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/kick/${userId}`, { method: "POST" }, auth);
        return res.ok;
    }, [auth]);

    const banMember = useCallback(async (guildId: string, userId: string, reason?: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/bans/${userId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
        }, auth);
        return res.ok;
    }, [auth]);

    const unbanMember = useCallback(async (guildId: string, userId: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/bans/${userId}`, { method: "DELETE" }, auth);
        return res.ok;
    }, [auth]);

    const getBans = useCallback(async (guildId: string): Promise<any[]> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/bans`, {}, auth);
        if (!res.ok) return [];
        return res.json();
    }, [auth]);

    return { updateGuild, deleteGuild, kickMember, banMember, unbanMember, getBans };
}
