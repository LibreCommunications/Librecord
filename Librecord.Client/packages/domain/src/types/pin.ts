export interface PinnedMessage {
    messageId: string;
    channelId: string;
    content: string;
    createdAt: string;
    author: { id: string; username: string; displayName: string };
    pinnedBy: { id: string; displayName: string };
    pinnedAt: string;
}
