import type { Message } from "../../types/message";

export interface DmEventMap {
    "dm:message:ping": {
        channelId: string;
        messageId: string;
        authorId: string;
        authorName: string;
    };

    "dm:message:new": {
        message: Message;
        clientMessageId?: string;
    };

    "dm:message:edited": {
        channelId: string;
        messageId: string;
        content: string;
        editedAt?: string;
    };

    "dm:message:deleted": {
        channelId: string;
        messageId: string;
    };

    "dm:user:typing": {
        channelId: string;
        userId: string;
        username: string;
    };

    "dm:user:stop-typing": {
        channelId: string;
        userId: string;
    };

    "dm:user:presence": {
        userId: string;
        status: string;
    };

    "dm:readstate:updated": {
        channelId: string;
        messageId: string;
        userId: string;
        readAt: string;
    };

    "friend:request:received": {
        fromUserId: string;
        fromUsername: string;
        fromDisplayName: string;
        fromAvatarUrl: string | null;
    };

    "friend:request:accepted": {
        friendUserId: string;
        friendUsername: string;
        friendDisplayName: string;
        friendAvatarUrl: string | null;
    };

    "friend:request:declined": {
        declinedByUserId: string;
    };

    "friend:removed": {
        removedByUserId: string;
    };

    "channel:message:pinned": {
        channelId: string;
        messageId: string;
    };

    "channel:message:unpinned": {
        channelId: string;
        messageId: string;
    };

    "dm:member:added": {
        channelId: string;
        userId: string;
    };

    "dm:member:left": {
        channelId: string;
        userId: string;
    };

    "dm:channel:created": {
        channelId: string;
    };

    "dm:channel:deleted": {
        channelId: string;
    };

    "channel:reaction:added": {
        channelId: string;
        messageId: string;
        userId: string;
        emoji: string;
    };

    "channel:reaction:removed": {
        channelId: string;
        messageId: string;
        userId: string;
        emoji: string;
    };
}
