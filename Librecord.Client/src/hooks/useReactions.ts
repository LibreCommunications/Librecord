import { useAuth } from "./useAuth";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export function useReactions() {
    const auth = useAuth();

    async function addReaction(messageId: string, emoji: string): Promise<boolean> {
        const res = await fetchWithAuth(
            `${API_URL}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
            { method: "PUT" },
            auth
        );
        return res.ok;
    }

    async function removeReaction(messageId: string, emoji: string): Promise<boolean> {
        const res = await fetchWithAuth(
            `${API_URL}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`,
            { method: "DELETE" },
            auth
        );
        return res.ok;
    }

    return { addReaction, removeReaction };
}
