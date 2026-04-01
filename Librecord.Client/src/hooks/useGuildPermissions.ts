import { useEffect, useState } from "react";
import { guilds } from "../api/client";
import type { GuildPermissions } from "../types/guild";

export type { GuildPermissions };

const NONE: GuildPermissions = {
    isOwner: false,
    manageGuild: false,
    manageChannels: false,
    manageRoles: false,
    manageMessages: false,
    kickMembers: false,
    banMembers: false,
    inviteMembers: false,
};

export function useGuildPermissions(guildId: string | undefined, channelId?: string) {
    const [permissions, setPermissions] = useState<GuildPermissions>(NONE);
    const [loaded, setLoaded] = useState(false);
    const [prevKey, setPrevKey] = useState(`${guildId}:${channelId}`);

    const key = `${guildId}:${channelId}`;
    if (key !== prevKey) {
        setPrevKey(key);
        setPermissions(NONE);
        setLoaded(false);
    }

    useEffect(() => {
        if (!guildId) return;
        let stale = false;

        guilds.myPermissions(guildId, channelId).then((result) => {
            if (stale) return;
            if (result) setPermissions(result);
            setLoaded(true);
        });

        return () => { stale = true; };
    }, [guildId, channelId]);

    return { permissions, loaded };
}
