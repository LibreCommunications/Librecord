import { useCallback } from "react";
import { search as searchApi } from "../api/client";
import type { SearchResult } from "../types/search";

export type { SearchResult };

export function useSearch() {
    const search = useCallback(
        (query: string, options?: { channelId?: string; guildId?: string; limit?: number }): Promise<SearchResult[]> =>
            searchApi.messages(query, options ?? {}) as Promise<SearchResult[]>,
        [],
    );

    return { search };
}
