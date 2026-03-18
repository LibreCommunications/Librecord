import { useAuth } from "../context/AuthContext";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export function useReadState() {
    const auth = useAuth();

    async function markAsRead(channelId: string, messageId: string): Promise<boolean> {
        const res = await fetchWithAuth(
            `${API_URL}/channels/${channelId}/ack`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messageId }),
            },
            auth
        );
        return res.ok;
    }

    async function getUnreadCounts(channelIds: string[]): Promise<Record<string, number>> {
        if (channelIds.length === 0) return {};

        const res = await fetchWithAuth(
            `${API_URL}/channels/unread`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channelIds }),
            },
            auth
        );

        if (!res.ok) return {};
        return res.json();
    }

    return { markAsRead, getUnreadCounts };
}
