import { useAuth } from "../context/AuthContext";
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
    const auth = useAuth();

    async function pinMessage(channelId: string, messageId: string): Promise<boolean> {
        const res = await fetchWithAuth(`${API_URL}/channels/${channelId}/pins/${messageId}`, { method: "POST" }, auth);
        return res.ok;
    }

    async function unpinMessage(channelId: string, messageId: string): Promise<boolean> {
        const res = await fetchWithAuth(`${API_URL}/channels/${channelId}/pins/${messageId}`, { method: "DELETE" }, auth);
        return res.ok;
    }

    async function getPins(channelId: string): Promise<PinnedMessage[]> {
        const res = await fetchWithAuth(`${API_URL}/channels/${channelId}/pins`, {}, auth);
        if (!res.ok) return [];
        return res.json();
    }

    return { pinMessage, unpinMessage, getPins };
}
