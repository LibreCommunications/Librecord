import { useCallback } from "react";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

interface GuildBanEntry {
    guildId: string;
    userId: string;
    moderatorId: string;
    reason: string | null;
    createdAt: string;
}

export function useGuildSettings() {

    const updateGuild = useCallback(async (guildId: string, data: { name?: string }): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return res.ok;
    }, []);

    const deleteGuild = useCallback(async (guildId: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}`, { method: "DELETE" });
        return res.ok;
    }, []);

    const kickMember = useCallback(async (guildId: string, userId: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/kick/${userId}`, { method: "POST" });
        return res.ok;
    }, []);

    const banMember = useCallback(async (guildId: string, userId: string, reason?: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/bans/${userId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
        });
        return res.ok;
    }, []);

    const unbanMember = useCallback(async (guildId: string, userId: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/bans/${userId}`, { method: "DELETE" });
        return res.ok;
    }, []);

    const getBans = useCallback(async (guildId: string): Promise<GuildBanEntry[]> => {
        const res = await fetchWithAuth(`${API_URL}/guilds/${guildId}/bans`, {});
        if (!res.ok) return [];
        return res.json();
    }, []);

    return { updateGuild, deleteGuild, kickMember, banMember, unbanMember, getBans };
}
