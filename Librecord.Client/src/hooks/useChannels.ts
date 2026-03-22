import { useCallback } from "react";
import { useAuth } from "./useAuth";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */
export interface GuildChannel {
    id: string;
    guildId: string;
    name: string;
    type: number; // GuildChannelType enum value
    position: number;
    topic: string | null;
    createdAt: string;
}

export interface CreateChannelDto {
    name: string;
    type: number; // GuildChannelType
    position: number;
    topic?: string | null;
}

export interface UpdateChannelDto {
    name?: string;
    topic?: string | null;
}

/* ------------------------------------------------------------------ */
/* HOOK                                                                */
/* ------------------------------------------------------------------ */
export function useChannels() {
    const auth = useAuth();

    /* ------------------------------------------------------------------ */
    /* GET SINGLE CHANNEL                                                  */
    /* GET /channels/{channelId}                                           */
    /* ------------------------------------------------------------------ */
    const getChannel = useCallback(async (channelId: string): Promise<GuildChannel | null> => {
        const res = await fetchWithAuth(
            `${API_URL}/channels/${channelId}`,
            {},
            auth
        );

        if (!res.ok) return null;
        return await res.json();
    }, [auth]);

    /* ------------------------------------------------------------------ */
    /* LIST CHANNELS FOR GUILD                                             */
    /* GET /channels/guild/{guildId}                                       */
    /* ------------------------------------------------------------------ */
    const getGuildChannels = useCallback(async (guildId: string): Promise<GuildChannel[]> => {
        const res = await fetchWithAuth(
            `${API_URL}/channels/guild/${guildId}`,
            {},
            auth
        );

        if (!res.ok) return [];
        return await res.json();
    }, [auth]);

    /* ------------------------------------------------------------------ */
    /* CREATE CHANNEL                                                      */
    /* POST /channels/guild/{guildId}                                      */
    /* ------------------------------------------------------------------ */
    const createChannel = useCallback(async (
        guildId: string,
        dto: CreateChannelDto
    ): Promise<GuildChannel | null> => {
        const res = await fetchWithAuth(
            `${API_URL}/channels/guild/${guildId}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dto),
            },
            auth
        );

        if (!res.ok) return null;
        return await res.json();
    }, [auth]);

    /* ------------------------------------------------------------------ */
    /* UPDATE CHANNEL                                                      */
    /* PUT /channels/{channelId}                                           */
    /* ------------------------------------------------------------------ */
    const updateChannel = useCallback(async (
        channelId: string,
        dto: UpdateChannelDto
    ): Promise<GuildChannel | null> => {
        const res = await fetchWithAuth(
            `${API_URL}/channels/${channelId}`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dto),
            },
            auth
        );

        if (!res.ok) return null;
        return await res.json();
    }, [auth]);

    /* ------------------------------------------------------------------ */
    /* DELETE CHANNEL                                                      */
    /* DELETE /channels/{channelId}                                        */
    /* ------------------------------------------------------------------ */
    const deleteChannel = useCallback(async (channelId: string): Promise<boolean> => {
        const res = await fetchWithAuth(
            `${API_URL}/channels/${channelId}`,
            { method: "DELETE" },
            auth
        );

        return res.ok;
    }, [auth]);

    return {
        getChannel,
        getGuildChannels,
        createChannel,
        updateChannel,
        deleteChannel,
    };
}
