export interface Thread {
    id: string;
    name: string;
    parentMessageId: string;
    creator: { id: string; displayName: string };
    messageCount: number;
    lastMessageAt: string | null;
    createdAt: string;
}

export interface ThreadMessage {
    id: string;
    content: string;
    createdAt: string;
    editedAt: string | null;
    author: { id: string; username: string; displayName: string; avatarUrl: string | null };
}
