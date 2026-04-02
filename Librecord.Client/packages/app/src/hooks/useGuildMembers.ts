import { useCallback } from "react";
import { guilds } from "@librecord/api-client";
import type { GuildMember } from "@librecord/domain";

export type { GuildMember };

export function useGuildMembers() {
    const getMembers = useCallback(
        (guildId: string): Promise<GuildMember[]> => guilds.members(guildId),
        [],
    );

    return { getMembers };
}
