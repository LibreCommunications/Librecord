import { useCallback } from "react";
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
    isGroup: boolean;
    isFriend?: boolean | null;
    members: DmUser[];
}

// --------------------------------------------------
// HOOK
// --------------------------------------------------
export function useDirectMessagesChannel() {
    const getMyDms = useCallback(async (): Promise<DmChannel[]> => {
        const res = await fetchWithAuth(`${API_URL}/dms`, {});
        if (!res.ok) return [];
        return await res.json();
    }, []);

    const startDm = useCallback(async (
        targetUserId: string,
        content: string
    ): Promise<string | null> => {
        const res = await fetchWithAuth(
            `${API_URL}/dms/start/${targetUserId}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            },
        );

        if (!res.ok) return null;
        const data = await res.json();

        // Notify the DmSidebar to refresh so the new conversation appears
        window.dispatchEvent(
            new CustomEvent("dm:channel:created", { detail: { channelId: data.channelId } })
        );

        return data.channelId;
    }, []);

    const getDmChannel = useCallback(async (channelId: string): Promise<DmChannel | null> => {
        const res = await fetchWithAuth(
            `${API_URL}/dms/${channelId}`,
            {},
        );

        if (!res.ok) return null;
        return await res.json();
    }, []);

    const addParticipant = useCallback(async (
        channelId: string,
        userId: string
    ): Promise<boolean> => {
        const res = await fetchWithAuth(
            `${API_URL}/dms/${channelId}/participants/${userId}`,
            { method: "POST" },
        );

        return res.ok;
    }, []);

    const leaveChannel = useCallback(async (channelId: string): Promise<boolean> => {
        const res = await fetchWithAuth(
            `${API_URL}/dms/${channelId}/leave`,
            { method: "DELETE" },
        );

        return res.ok;
    }, []);

    const deleteDm = useCallback(async (channelId: string): Promise<boolean> => {
        const res = await fetchWithAuth(
            `${API_URL}/dms/${channelId}`,
            { method: "DELETE" },
        );

        return res.ok;
    }, []);

    const createGroup = useCallback(async (memberIds: string[], name: string): Promise<string | null> => {
        const res = await fetchWithAuth(
            `${API_URL}/dms/group`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, memberIds }),
            },
        );

        if (!res.ok) return null;
        const data = await res.json();

        // Notify the DmSidebar to refresh so the new group appears
        window.dispatchEvent(
            new CustomEvent("dm:channel:created", { detail: { channelId: data.channelId } })
        );

        return data.channelId;
    }, []);

    return {
        getMyDms,
        startDm,
        getDmChannel,
        addParticipant,
        leaveChannel,
        deleteDm,
        createGroup,
    };
}
