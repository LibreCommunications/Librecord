import { useAuth } from "../context/AuthContext";
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
    const auth = useAuth();

    // ------------------------------------------------------------------
    // GET USER GUILDS (SIDEBAR)
    // ------------------------------------------------------------------
    async function getGuilds(): Promise<GuildSummary[]> {
        const res = await fetchWithAuth(
            `${API_URL}/guilds`,
            {},
            auth
        );

        if (!res.ok) return [];
        return await res.json();
    }

    // ------------------------------------------------------------------
    // GET SINGLE GUILD
    // ------------------------------------------------------------------
    async function getGuild(guildId: string): Promise<Guild | null> {
        const res = await fetchWithAuth(
            `${API_URL}/guilds/${guildId}`,
            {},
            auth
        );

        if (!res.ok) return null;
        return await res.json();
    }

    // ------------------------------------------------------------------
    // CREATE GUILD
    // ------------------------------------------------------------------
    async function createGuild(name: string): Promise<Guild | null> {
        if (!name.trim()) return null;

        const res = await fetchWithAuth(
            `${API_URL}/guilds`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name })
            },
            auth
        );

        if (!res.ok) return null;
        return await res.json();
    }

    // ------------------------------------------------------------------
    // GET GUILD CHANNELS
    // ------------------------------------------------------------------
    async function getGuildChannels(guildId: string): Promise<GuildChannel[]> {
        const res = await fetchWithAuth(
            `${API_URL}/guilds/${guildId}/channels`,
            {},
            auth
        );

        if (!res.ok) return [];
        return await res.json();
    }

    // ------------------------------------------------------------------
    // GET SINGLE CHANNEL (ACCESS-CHECKED)
    // ------------------------------------------------------------------
    async function getChannel(channelId: string): Promise<GuildChannel | null> {
        const res = await fetchWithAuth(
            `${API_URL}/guilds/channels/${channelId}`,
            {},
            auth
        );

        if (!res.ok) return null;
        return await res.json();
    }

    return {
        getGuilds,
        getGuild,
        createGuild,
        getGuildChannels,
        getChannel,
    };
}
