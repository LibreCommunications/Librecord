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

    async function getOverrides(channelId: string): Promise<ChannelOverride[]> {
        const res = await fetchWithAuth(
            `${API_URL}/channels/${channelId}/permissions`,
            {},
            auth
        );
        if (!res.ok) return [];
        return res.json();
    }

    async function setOverride(
        channelId: string,
        opts: {
            roleId?: string | null;
            userId?: string | null;
            permissionId: string;
            allow: boolean | null;
        }
    ): Promise<boolean> {
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
    }

    return { getOverrides, setOverride };
}
