import { useEffect, useState } from "react";
import { guilds } from "../api/client";
import type { GuildPermissions } from "../types/guild";

export type { GuildPermissions };

const NONE: GuildPermissions = {
    isOwner: false,
    manageGuild: false,
    manageChannels: false,
    manageRoles: false,
    kickMembers: false,
    banMembers: false,
    inviteMembers: false,
};

export function useGuildPermissions(guildId: string | undefined) {
    const [permissions, setPermissions] = useState<GuildPermissions>(NONE);
    const [loaded, setLoaded] = useState(false);
    const [prevGuildId, setPrevGuildId] = useState(guildId);

    if (guildId !== prevGuildId) {
        setPrevGuildId(guildId);
        setPermissions(NONE);
        setLoaded(false);
    }

    useEffect(() => {
        if (!guildId) return;
        let stale = false;

        guilds.myPermissions(guildId).then((result) => {
            if (stale) return;
            if (result) setPermissions(result);
            setLoaded(true);
        });

        return () => { stale = true; };
    }, [guildId]);

    return { permissions, loaded };
}
