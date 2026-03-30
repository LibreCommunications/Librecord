import type { UserSummary } from "./user";

export interface ReplyInfo {
    messageId: string;
    content: string;
    author?: UserSummary | null;
}

export interface Message {
    id: string;
    channelId: string;
    content: string;
    createdAt: string;
    editedAt?: string | null;

    author: UserSummary;
    replyTo?: ReplyInfo | null;

    attachments: MessageAttachment[];
    reactions: MessageReaction[];
    edits: MessageEdit[];

    threadId?: string | null;
    threadName?: string | null;
    threadMessageCount?: number;
}

export interface TransportMessage {
    id: string;                 // real messageId (server)
    channelId: string;

    clientMessageId?: string;   // echoed back for optimistic reconciliation

    content: string;
    createdAt: string;
    editedAt?: string | null;

    author: UserSummary;
    replyTo?: ReplyInfo | null;

    attachments: MessageAttachment[];
    reactions: MessageReaction[];
    edits: MessageEdit[];
}




export interface MessageAttachment {
    id: string;
    fileName: string;
    url: string;
    contentType: string;
    size: number;
    isSpoiler: boolean;
    width?: number | null;
    height?: number | null;
}

export interface MessageReaction {
    userId: string;
    emoji: string;
    createdAt: string;
}

export interface MessageEdit {
    id: string;
    oldContent: string;
    editedAt: string;
    editorId: string;
}

export interface CreateMessageDto {
    contentBase64: string;
}

export interface UpdateMessageDto {
    contentBase64: string;
}
