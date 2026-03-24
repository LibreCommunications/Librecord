import { useEffect, useState } from "react";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export interface GuildPermissions {
    manageGuild: boolean;
    manageChannels: boolean;
    manageRoles: boolean;
    kickMembers: boolean;
    banMembers: boolean;
    inviteMembers: boolean;
}

const NONE: GuildPermissions = {
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

    // Reset synchronously during render when guild changes
    if (guildId !== prevGuildId) {
        setPrevGuildId(guildId);
        setPermissions(NONE);
        setLoaded(false);
    }

    useEffect(() => {
        if (!guildId) return;
        let stale = false;

        fetchWithAuth(`${API_URL}/guilds/${guildId}/permissions/me`, {})
            .then(async (res) => {
                if (stale) return;
                if (res.ok) setPermissions(await res.json());
                setLoaded(true);
            });

        return () => { stale = true; };
    }, [guildId]);

    return { permissions, loaded };
}
