import { useCallback } from "react";
import { useAuth } from "./useAuth";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export interface ChannelOverride {
    id: string;
    channelId: string;
    roleId: string | null;
    userId: string | null;
    permissionId: string;
    allow: boolean | null;
}

export function useChannelPermissions() {
    const auth = useAuth();

    const getOverrides = useCallback(async (channelId: string): Promise<ChannelOverride[]> => {
        const res = await fetchWithAuth(
            `${API_URL}/channels/${channelId}/permissions`,
            {},
            auth
        );
        if (!res.ok) return [];
        return res.json();
    }, [auth]);

    const setOverride = useCallback(async (
        channelId: string,
        opts: {
            roleId?: string | null;
            userId?: string | null;
            permissionId: string;
            allow: boolean | null;
        }
    ): Promise<boolean> => {
        const res = await fetchWithAuth(
            `${API_URL}/channels/${channelId}/permissions`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(opts),
            },
            auth
        );
        return res.ok;
    }, [auth]);

    return { getOverrides, setOverride };
}
