import { useCallback } from "react";
import { useAuth } from "./useAuth";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export interface GuildInvite {
    id: string;
    code: string;
    guildId: string;
    creator: {
        id: string;
        username: string;
        displayName: string;
    };
    maxUses: number | null;
    usesCount: number;
    expiresAt: string | null;
    createdAt: string;
}

export interface InvitePreview {
    code: string;
    guild: {
        id: string;
        name: string;
        iconUrl: string | null;
    };
}

export function useGuildInvites() {
    const auth = useAuth();

    const createInvite = useCallback(async (
        guildId: string,
        options?: { maxUses?: number; expiresInHours?: number }
    ): Promise<GuildInvite | null> => {
        const res = await fetchWithAuth(
            `${API_URL}/guilds/${guildId}/invites`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(options ?? {}),
            },
            auth
        );

        if (!res.ok) return null;
        return res.json();
    }, [auth]);

    const getInvites = useCallback(async (guildId: string): Promise<GuildInvite[]> => {
        const res = await fetchWithAuth(
            `${API_URL}/guilds/${guildId}/invites`,
            {},
            auth
        );

        if (!res.ok) return [];
        return res.json();
    }, [auth]);

    const getInvitePreview = useCallback(async (code: string): Promise<InvitePreview | null> => {
        const res = await fetchWithAuth(
            `${API_URL}/invites/${code}`,
            {},
            auth
        );

        if (!res.ok) return null;
        return res.json();
    }, [auth]);

    const joinByCode = useCallback(async (code: string): Promise<{ id: string; name: string } | null> => {
        const res = await fetchWithAuth(
            `${API_URL}/invites/${code}/join`,
            { method: "POST" },
            auth
        );

        if (!res.ok) return null;
        return res.json();
    }, [auth]);

    const revokeInvite = useCallback(async (inviteId: string): Promise<boolean> => {
        const res = await fetchWithAuth(
            `${API_URL}/invites/${inviteId}`,
            { method: "DELETE" },
            auth
        );

        return res.ok;
    }, [auth]);

    return {
        createInvite,
        getInvites,
        getInvitePreview,
        joinByCode,
        revokeInvite,
    };
}
