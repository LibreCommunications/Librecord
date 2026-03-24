import { useCallback } from "react";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export function useReadState() {
    const markAsRead = useCallback(async (channelId: string, messageId: string): Promise<boolean> => {
        console.log(`[ReadState] markAsRead called — channel=${channelId} message=${messageId}`);
        try {
            const res = await fetchWithAuth(
                `${API_URL}/channels/${channelId}/ack`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messageId }),
                },
            );
            if (!res.ok) {
                console.warn(`[ReadState] markAsRead failed: ${res.status} for channel=${channelId} message=${messageId}`);
            } else {
                console.log(`[ReadState] markAsRead success — channel=${channelId} message=${messageId}`);
            }
            return res.ok;
        } catch (err) {
            console.warn("[ReadState] markAsRead error:", err);
            return false;
        }
    }, []);

    const getUnreadCounts = useCallback(async (channelIds: string[]): Promise<Record<string, number>> => {
        console.log(`[ReadState] getUnreadCounts called — channels=${JSON.stringify(channelIds)}`);
        if (channelIds.length === 0) return {};

        const res = await fetchWithAuth(
            `${API_URL}/channels/unread`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channelIds }),
            },
        );

        if (!res.ok) return {};
        const counts = await res.json();
        console.log(`[ReadState] getUnreadCounts result —`, counts);
        return counts;
    }, []);

    return { markAsRead, getUnreadCounts };
}
