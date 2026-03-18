import type { Message } from "../../types/message";

export interface DmEventMap {
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
}
