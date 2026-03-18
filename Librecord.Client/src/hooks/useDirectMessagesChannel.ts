import { useAuth } from "../context/AuthContext";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

// --------------------------------------------------
// TYPES
// --------------------------------------------------
export interface DmUser {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
}

export interface DmChannel {
    id: string;
    name?: string | null;
    members: DmUser[];
}

// --------------------------------------------------
// HOOK
// --------------------------------------------------
export function useDirectMessagesChannel() {
    const auth = useAuth();

    async function getMyDms(): Promise<DmChannel[]> {
        const res = await fetchWithAuth(`${API_URL}/dms`, {}, auth);
        if (!res.ok) return [];
        return await res.json();
    }

    async function startDm(
        targetUserId: string,
        content: string
    ): Promise<string | null> {
        const res = await fetchWithAuth(
            `${API_URL}/dms/start/${targetUserId}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            },
            auth
        );

        if (!res.ok) return null;
        const data = await res.json();
        return data.channelId;
    }

    async function getDmChannel(channelId: string): Promise<DmChannel | null> {
        const res = await fetchWithAuth(
            `${API_URL}/dms/${channelId}`,
            {},
            auth
        );

        if (!res.ok) return null;
        return await res.json();
    }

    async function addParticipant(
        channelId: string,
        userId: string
    ): Promise<boolean> {
        const res = await fetchWithAuth(
            `${API_URL}/dms/${channelId}/participants/${userId}`,
            { method: "POST" },
            auth
        );

        return res.ok;
    }

    async function leaveChannel(channelId: string): Promise<boolean> {
        const res = await fetchWithAuth(
            `${API_URL}/dms/${channelId}/leave`,
            { method: "DELETE" },
            auth
        );

        return res.ok;
    }

    return {
        getMyDms,
        startDm,
        getDmChannel,
        addParticipant,
        leaveChannel,
    };
}
