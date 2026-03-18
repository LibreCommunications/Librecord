import type { Message } from "../../types/message";
import type {
    DmRealtimeMessageTransport,
    DmRealtimeMessageEditedTransport,
} from "./dmTypes";

// --------------------------------------------------
// MESSAGE CREATED
// --------------------------------------------------
export function mapDmRealtimeToMessage(
    msg: DmRealtimeMessageTransport
): Message {
    return {
        id: msg.messageId,
        channelId: msg.channelId,

        content: msg.content,        
        createdAt: msg.createdAt,
        editedAt: null,

        author: msg.author,

        attachments: msg.attachments ?? [],
        reactions: msg.reactions ?? [],
        edits: msg.edits ?? [],
    };
}

// --------------------------------------------------
// MESSAGE EDITED
// --------------------------------------------------
export function mapDmRealtimeEdit(
    msg: DmRealtimeMessageEditedTransport
) {
    return {
        channelId: msg.channelId,
        messageId: msg.messageId,

        content: msg.content,        
        editedAt: msg.editedAt,
    };
}
