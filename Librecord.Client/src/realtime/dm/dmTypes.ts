import type {
    MessageAttachment,
    MessageReaction,
    MessageEdit,
} from "../../types/message";

// -----------------------------
// AUTHOR
// -----------------------------
export interface DmRealtimeAuthor {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
}

// -----------------------------
// TRANSPORT TYPES (FROM SERVER)
// -----------------------------
export interface DmRealtimeMessageTransport {
    channelId: string;
    messageId: string;
    clientMessageId?: string;

    content: string;     
    createdAt: string;

    author: DmRealtimeAuthor;

    attachments: MessageAttachment[];
    reactions: MessageReaction[];
    edits: MessageEdit[];
}

export interface DmRealtimeMessageEditedTransport {
    channelId: string;
    messageId: string;

    content: string;         
    editedAt?: string;
}

export interface DmRealtimeMessageDeletedTransport {
    channelId: string;
    messageId: string;
}

export interface DmRealtimeReadStateUpdatedTransport {
    channelId: string;
    messageId: string;
    userId: string;
    readAt: string;
}
