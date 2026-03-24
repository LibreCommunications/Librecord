import { useCallback } from "react";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export function useReadState() {
    const markAsRead = useCallback(async (channelId: string, messageId: string): Promise<boolean> => {
        try {
            const res = await fetchWithAuth(
                `${API_URL}/channels/${channelId}/ack`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ messageId }),
                },
            );
            return res.ok;
        } catch {
            return false;
        }
    }, []);

    const getUnreadCounts = useCallback(async (channelIds: string[]): Promise<Record<string, number>> => {
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
        return await res.json();
    }, []);

    return { markAsRead, getUnreadCounts };
}
