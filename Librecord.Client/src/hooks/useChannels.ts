import { useCallback } from "react";
import { guilds, channels } from "../api/client";
import type { GuildChannel } from "../types/guild";

export type { GuildChannel };

export interface CreateChannelDto {
    name: string;
    type: number;
    position: number;
    topic?: string | null;
}

export interface UpdateChannelDto {
    name?: string;
    topic?: string | null;
}

export function useChannels() {
    const getChannel = useCallback(
        (channelId: string): Promise<GuildChannel | null> => guilds.getChannel(channelId),
        [],
    );

    const getGuildChannels = useCallback(
        (guildId: string): Promise<GuildChannel[]> => guilds.channels(guildId),
        [],
    );

    const createChannel = useCallback(
        async (guildId: string, dto: CreateChannelDto): Promise<GuildChannel | null> => {
            try {
                return await channels.create(guildId, dto);
            } catch {
                return null;
            }
        },
        [],
    );

    const updateChannel = useCallback(
        async (channelId: string, dto: UpdateChannelDto): Promise<GuildChannel | null> => {
            try {
                return await channels.update(channelId, dto);
            } catch {
                return null;
            }
        },
        [],
    );

    const deleteChannel = useCallback(async (channelId: string): Promise<boolean> => {
        try {
            await channels.delete(channelId);
            return true;
        } catch {
            return false;
        }
    }, []);

    return {
        getChannel,
        getGuildChannels,
        createChannel,
        updateChannel,
        deleteChannel,
    };
}
