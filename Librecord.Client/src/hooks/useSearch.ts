import { useCallback } from "react";
import { search as searchApi } from "../api/client";

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
    const search = useCallback(
        (query: string, options?: { channelId?: string; guildId?: string; limit?: number }): Promise<SearchResult[]> =>
            searchApi.messages(query, options ?? {}) as Promise<SearchResult[]>,
        [],
    );

    return { search };
}
