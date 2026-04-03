import type { Message } from "../types/message";
import type {
    GuildRealtimeMessageTransport,
    GuildRealtimeMessageEditedTransport,
} from "./guildTypes";

export function mapGuildRealtimeToMessage(
    msg: GuildRealtimeMessageTransport
): Message {
    return {
        id: msg.messageId,
        channelId: msg.channelId,

        content: msg.content,
        createdAt: msg.createdAt,
        editedAt: null,

        author: msg.author,
        replyTo: msg.replyTo ?? null,

        attachments: msg.attachments ?? [],
        reactions: msg.reactions ?? [],
        edits: msg.edits ?? [],
    };
}

export function mapGuildRealtimeEdit(
    msg: GuildRealtimeMessageEditedTransport
) {
    return {
        channelId: msg.channelId,
        messageId: msg.messageId,

        content: msg.content,
        editedAt: msg.editedAt,
    };
}
