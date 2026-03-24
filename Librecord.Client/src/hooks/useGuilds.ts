import { useCallback } from "react";
import { guilds } from "../api/client";
import type { GuildSummary, Guild, GuildChannel } from "../types/guild";

export type { GuildSummary, Guild, GuildChannel };

export function useGuilds() {
    const getGuilds = useCallback((): Promise<GuildSummary[]> => guilds.list(), []);

    const getGuild = useCallback((guildId: string): Promise<Guild | null> => guilds.get(guildId), []);

    const createGuild = useCallback(async (name: string): Promise<Guild | null> => {
        if (!name.trim()) return null;
        try {
            return await guilds.create(name);
        } catch {
            return null;
        }
    }, []);

    const getGuildChannels = useCallback((guildId: string): Promise<GuildChannel[]> => guilds.channels(guildId), []);

    const getChannel = useCallback((channelId: string): Promise<GuildChannel | null> => guilds.getChannel(channelId), []);

    return {
        getGuilds,
        getGuild,
        createGuild,
        getGuildChannels,
        getChannel,
    };
}
