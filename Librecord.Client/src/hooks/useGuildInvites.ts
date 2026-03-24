import { useCallback } from "react";
import { invites } from "../api/client";
import type { GuildInvite } from "../types/guild";

export type { GuildInvite };

export interface InvitePreview {
    code: string;
    guild: {
        id: string;
        name: string;
        iconUrl: string | null;
    };
}

export function useGuildInvites() {
    const createInvite = useCallback(
        async (guildId: string, options?: { maxUses?: number; expiresInHours?: number }): Promise<GuildInvite | null> => {
            try {
                return await invites.create(guildId, options);
            } catch {
                return null;
            }
        },
        [],
    );

    const getInvites = useCallback(
        (guildId: string): Promise<GuildInvite[]> => invites.list(guildId),
        [],
    );

    const getInvitePreview = useCallback(
        (code: string): Promise<InvitePreview | null> => invites.getByCode(code),
        [],
    );

    const joinByCode = useCallback(
        async (code: string): Promise<{ id: string; name: string } | null> => {
            try {
                return await invites.join(code);
            } catch {
                return null;
            }
        },
        [],
    );

    const revokeInvite = useCallback(async (inviteId: string): Promise<boolean> => {
        try {
            await invites.revoke(inviteId);
            return true;
        } catch {
            return false;
        }
    }, []);

    return {
        createInvite,
        getInvites,
        getInvitePreview,
        joinByCode,
        revokeInvite,
    };
}
