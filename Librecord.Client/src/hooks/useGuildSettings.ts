import { useCallback } from "react";
import { guilds, guildModeration, type GuildBanEntry } from "../api/client";

export type { GuildBanEntry };

export function useGuildSettings() {
    const updateGuild = useCallback(async (guildId: string, data: { name?: string }): Promise<boolean> => {
        try {
            await guilds.update(guildId, data as { name: string });
            return true;
        } catch {
            return false;
        }
    }, []);

    const deleteGuild = useCallback(async (guildId: string): Promise<boolean> => {
        try {
            await guilds.delete(guildId);
            return true;
        } catch {
            return false;
        }
    }, []);

    const kickMember = useCallback(async (guildId: string, userId: string): Promise<boolean> => {
        try {
            await guildModeration.kick(guildId, userId);
            return true;
        } catch {
            return false;
        }
    }, []);

    const banMember = useCallback(async (guildId: string, userId: string, reason?: string): Promise<boolean> => {
        try {
            await guildModeration.ban(guildId, userId, reason);
            return true;
        } catch {
            return false;
        }
    }, []);

    const unbanMember = useCallback(async (guildId: string, userId: string): Promise<boolean> => {
        try {
            await guildModeration.unban(guildId, userId);
            return true;
        } catch {
            return false;
        }
    }, []);

    const getBans = useCallback(
        (guildId: string): Promise<GuildBanEntry[]> => guildModeration.getBans(guildId),
        [],
    );

    return { updateGuild, deleteGuild, kickMember, banMember, unbanMember, getBans };
}
