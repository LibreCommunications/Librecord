import { useCallback } from "react";
import { dmMessages } from "@librecord/api-client";
import type { Message } from "@librecord/domain";

export function useDirectMessages() {
    const getChannelMessages = useCallback(
        (channelId: string, limit = 50, before?: string): Promise<Message[]> =>
            dmMessages.list(channelId, limit, before),
        [],
    );

    const sendMessage = useCallback(
        (channelId: string, content: string, clientMessageId: string, replyToMessageId?: string): Promise<void> =>
            dmMessages.send(channelId, content, clientMessageId, replyToMessageId),
        [],
    );

    const editMessage = useCallback(
        (messageId: string, content: string): Promise<Message> =>
            dmMessages.edit(messageId, content),
        [],
    );

    const deleteMessage = useCallback(
        (messageId: string): Promise<void> =>
            dmMessages.delete(messageId),
        [],
    );

    return {
        getChannelMessages,
        sendMessage,
        editMessage,
        deleteMessage,
    };
}
