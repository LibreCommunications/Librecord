import { useCallback } from "react";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export function useReactions() {

    const addReaction = useCallback(async (messageId: string, emoji: string): Promise<boolean> => {
        const res = await fetchWithAuth(
            `${API_URL}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
            { method: "PUT" },
        );
        return res.ok;
    }, []);

    const removeReaction = useCallback(async (messageId: string, emoji: string): Promise<boolean> => {
        const res = await fetchWithAuth(
            `${API_URL}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
            { method: "DELETE" },
        );
        return res.ok;
    }, []);

    return { addReaction, removeReaction };
}
