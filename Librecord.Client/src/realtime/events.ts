import type { Message } from "../types/message";

export interface AppEventMap {
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

    "guild:message:ping": {
        channelId: string;
        messageId: string;
        authorId: string;
        authorName: string;
    };

    "guild:message:new": {
        message: Message;
        clientMessageId?: string;
    };

    "guild:message:edited": {
        channelId: string;
        messageId: string;
        content: string;
        editedAt?: string;
    };

    "guild:message:deleted": {
        channelId: string;
        messageId: string;
    };

    "guild:user:typing": {
        channelId: string;
        userId: string;
        username: string;
    };

    "guild:user:stop-typing": {
        channelId: string;
        userId: string;
    };

    "guild:user:presence": {
        userId: string;
        status: string;
    };

    "guild:channel:created": {
        channelId: string;
        guildId: string;
        name: string;
        type: number;
        position: number;
        parentId?: string | null;
    };

    "guild:member:roles": {
        guildId: string;
        userId: string;
        roles: { id: string; name: string }[];
    };

    "guild:member:added": {
        guildId: string;
        userId: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
        joinedAt: string;
    };

    "guild:member:removed": {
        guildId: string;
        userId: string;
        action: "kick" | "ban" | "leave";
        reason?: string | null;
    };

    "guild:channel:updated": {
        channelId: string;
        guildId: string;
        name: string;
        topic?: string | null;
        parentId?: string | null;
    };

    "guild:channel:deleted": {
        channelId: string;
        guildId: string;
    };

    "guild:updated": {
        guildId: string;
        name?: string;
        iconUrl?: string | null;
    };

    "guild:deleted": {
        guildId: string;
    };

    "voice:user:joined": {
        channelId: string;
        guildId: string;
        userId: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
        isMuted: boolean;
        isDeafened: boolean;
        isCameraOn: boolean;
        isScreenSharing: boolean;
    };

    "voice:user:left": {
        channelId: string;
        guildId: string;
        userId: string;
    };

    "voice:user:state": {
        channelId: string;
        guildId: string;
        userId: string;
        isMuted: boolean;
        isDeafened: boolean;
        isCameraOn: boolean;
        isScreenSharing: boolean;
    };

    "channel:message:pinned": {
        channelId: string;
        messageId: string;
    };

    "channel:message:unpinned": {
        channelId: string;
        messageId: string;
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

    "guild:thread:message:new": {
        channelId: string;
        threadId: string;
        messageId: string;
        content: string;
        createdAt: string;
        author: {
            id: string;
            username: string;
            displayName: string;
            avatarUrl: string | null;
        };
    };
}
