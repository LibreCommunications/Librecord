import { useCallback } from "react";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

// -----------------------------
// TYPES
// -----------------------------
export interface GuildSummary {
    id: string;
    name: string;
    iconUrl: string | null;
}

export interface Guild {
    id: string;
    name: string;
    iconUrl: string | null;
    createdAt?: string;
}

export interface GuildChannel {
    id: string;
    name: string;
    type: number;
    parentId: string | null;
}

// -----------------------------
// HOOK
// -----------------------------
export function useGuilds() {

    // ------------------------------------------------------------------
    // GET USER GUILDS (SIDEBAR)
    // ------------------------------------------------------------------
    const getGuilds = useCallback(async (): Promise<GuildSummary[]> => {
        const res = await fetchWithAuth(
            `${API_URL}/guilds`,
            {},
        );

        if (!res.ok) return [];
        return await res.json();
    }, []);

    // ------------------------------------------------------------------
    // GET SINGLE GUILD
    // ------------------------------------------------------------------
    const getGuild = useCallback(async (guildId: string): Promise<Guild | null> => {
        const res = await fetchWithAuth(
            `${API_URL}/guilds/${guildId}`,
            {},
        );

        if (!res.ok) return null;
        return await res.json();
    }, []);

    // ------------------------------------------------------------------
    // CREATE GUILD
    // ------------------------------------------------------------------
    const createGuild = useCallback(async (name: string): Promise<Guild | null> => {
        if (!name.trim()) return null;

        const res = await fetchWithAuth(
            `${API_URL}/guilds`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name })
            },
        );

        if (!res.ok) return null;
        return await res.json();
    }, []);

    // ------------------------------------------------------------------
    // GET GUILD CHANNELS
    // ------------------------------------------------------------------
    const getGuildChannels = useCallback(async (guildId: string): Promise<GuildChannel[]> => {
        const res = await fetchWithAuth(
            `${API_URL}/guilds/${guildId}/channels`,
            {},
        );

        if (!res.ok) return [];
        return await res.json();
    }, []);

    // ------------------------------------------------------------------
    // GET SINGLE CHANNEL (ACCESS-CHECKED)
    // ------------------------------------------------------------------
    const getChannel = useCallback(async (channelId: string): Promise<GuildChannel | null> => {
        const res = await fetchWithAuth(
            `${API_URL}/guilds/channels/${channelId}`,
            {},
        );

        if (!res.ok) return null;
        return await res.json();
    }, []);

    return {
        getGuilds,
        getGuild,
        createGuild,
        getGuildChannels,
        getChannel,
    };
}
