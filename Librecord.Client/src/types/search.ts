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
