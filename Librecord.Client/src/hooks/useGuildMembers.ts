import { useCallback } from "react";
import { guilds } from "../api/client";
import type { GuildMember } from "../types/guild";

export type { GuildMember };

export function useGuildMembers() {
    const getMembers = useCallback(
        (guildId: string): Promise<GuildMember[]> => guilds.members(guildId),
        [],
    );

    return { getMembers };
}
