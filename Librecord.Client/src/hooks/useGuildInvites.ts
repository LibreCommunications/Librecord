import { useCallback } from "react";
import { invites, ApiError } from "../api/client";
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
        async (code: string): Promise<{ ok: true; guild: { id: string; name: string } } | { ok: false; error: string }> => {
            try {
                const guild = await invites.join(code);
                return { ok: true, guild };
            } catch (e) {
                if (e instanceof ApiError && e.body) {
                    // Backend returns plain string or JSON string
                    try { return { ok: false, error: JSON.parse(e.body) }; } catch { /* not JSON */ }
                    return { ok: false, error: e.body };
                }
                return { ok: false, error: "Failed to join. The invite may be expired or invalid." };
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
