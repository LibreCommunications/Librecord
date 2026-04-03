import { useCallback } from "react";
import { guildMessages } from "@librecord/api-client";
import type { Message } from "@librecord/domain";

export function useGuildChannelMessages() {
    const getMessage = useCallback(
        (channelId: string, messageId: string): Promise<Message | null> =>
            guildMessages.get(channelId, messageId),
        [],
    );

    const getChannelMessages = useCallback(
        (channelId: string, limit = 50, before?: string): Promise<Message[]> =>
            guildMessages.list(channelId, limit, before),
        [],
    );

    const createMessage = useCallback(
        async (channelId: string, content: string, clientMessageId?: string, replyToMessageId?: string): Promise<Message | null> => {
            try {
                return await guildMessages.create(channelId, content, clientMessageId, replyToMessageId);
            } catch {
                return null;
            }
        },
        [],
    );

    const editMessage = useCallback(
        (channelId: string, messageId: string, content: string): Promise<Message | null> =>
            guildMessages.edit(channelId, messageId, content),
        [],
    );

    const deleteMessage = useCallback(
        (channelId: string, messageId: string): Promise<void> =>
            guildMessages.delete(channelId, messageId),
        [],
    );

    return {
        getMessage,
        getChannelMessages,
        createMessage,
        editMessage,
        deleteMessage,
    };
}
