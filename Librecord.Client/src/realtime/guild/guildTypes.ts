import type {
    MessageAttachment,
    MessageReaction,
    MessageEdit,
} from "../../types/message";

export interface GuildRealtimeAuthor {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
}

export interface GuildRealtimeMessageTransport {
    channelId: string;
    messageId: string;
    clientMessageId?: string;

    content: string;
    createdAt: string;

    author: GuildRealtimeAuthor;

    attachments?: MessageAttachment[];
    reactions?: MessageReaction[];
    edits?: MessageEdit[];
}

export interface GuildRealtimeMessageEditedTransport {
    channelId: string;
    messageId: string;

    content: string;
    editedAt?: string;
}

export interface GuildRealtimeMessageDeletedTransport {
    channelId: string;
    messageId: string;
}
