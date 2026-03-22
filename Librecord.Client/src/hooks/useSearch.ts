import { useAuth } from "./useAuth";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export interface SearchResult {
    id: string;
    channelId: string;
    content: string;
    createdAt: string;
    author: {
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
    };
}

export function useSearch() {
    const auth = useAuth();

    async function search(
        query: string,
        options?: { channelId?: string; guildId?: string; limit?: number }
    ): Promise<SearchResult[]> {
        const params = new URLSearchParams({ q: query });
        if (options?.channelId) params.set("channelId", options.channelId);
        if (options?.guildId) params.set("guildId", options.guildId);
        if (options?.limit) params.set("limit", String(options.limit));

        const res = await fetchWithAuth(
            `${API_URL}/search?${params}`,
            {},
            auth
        );

        if (!res.ok) return [];
        return res.json();
    }

    return { search };
}
