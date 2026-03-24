import { useCallback } from "react";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export interface PinnedMessage {
    messageId: string;
    channelId: string;
    content: string;
    createdAt: string;
    author: { id: string; username: string; displayName: string };
    pinnedBy: { id: string; displayName: string };
    pinnedAt: string;
}

export function usePins() {

    const pinMessage = useCallback(async (channelId: string, messageId: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/channels/${channelId}/pins/${messageId}`, { method: "POST" });
        return res.ok;
    }, []);

    const unpinMessage = useCallback(async (channelId: string, messageId: string): Promise<boolean> => {
        const res = await fetchWithAuth(`${API_URL}/channels/${channelId}/pins/${messageId}`, { method: "DELETE" });
        return res.ok;
    }, []);

    const getPins = useCallback(async (channelId: string): Promise<PinnedMessage[]> => {
        const res = await fetchWithAuth(`${API_URL}/channels/${channelId}/pins`, {});
        if (!res.ok) return [];
        return res.json();
    }, []);

    return { pinMessage, unpinMessage, getPins };
}
