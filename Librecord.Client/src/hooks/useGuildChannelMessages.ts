import { useAuth } from "./useAuth";
import { fetchWithAuth } from "../api/fetchWithAuth";
import type { Message } from "../types/message";

const API_URL = import.meta.env.VITE_API_URL;

// --------------------------------------------------
// GUILD CHANNEL MESSAGES HOOK
// --------------------------------------------------
export function useGuildChannelMessages() {
    const auth = useAuth();

    // ----------------------------------------------
    // GET SINGLE MESSAGE
    // GET /guild-channels/{channelId}/messages/{messageId}
    // ----------------------------------------------
    async function getMessage(
        channelId: string,
        messageId: string
    ): Promise<Message | null> {
        const res = await fetchWithAuth(
            `${API_URL}/guild-channels/${channelId}/messages/${messageId}`,
            {},
            auth
        );

        if (!res.ok) return null;
        return res.json();
    }

    // ----------------------------------------------
    // GET CHANNEL MESSAGES
    // GET /guild-channels/{channelId}/messages
    // ----------------------------------------------
    async function getChannelMessages(
        channelId: string,
        limit = 50,
        before?: string
    ): Promise<Message[]> {
        const params = new URLSearchParams({
            limit: String(limit),
        });

        if (before) params.set("before", before);

        const res = await fetchWithAuth(
            `${API_URL}/guild-channels/${channelId}/messages?${params}`,
            {},
            auth
        );

        if (!res.ok) return [];
        return res.json();
    }

    // ----------------------------------------------
    // CREATE MESSAGE
    // POST /guild-channels/{channelId}/messages
    // ----------------------------------------------
    async function createMessage(
        channelId: string,
        content: string,
        clientMessageId?: string
    ): Promise<Message | null> {
        const res = await fetchWithAuth(
            `${API_URL}/guild-channels/${channelId}/messages`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content, clientMessageId }),
            },
            auth
        );

        if (!res.ok) return null;
        return res.json();
    }

    // ----------------------------------------------
    // EDIT MESSAGE
    // PUT /guild-channels/{channelId}/messages/{messageId}
    // ----------------------------------------------
    async function editMessage(
        channelId: string,
        messageId: string,
        content: string
    ): Promise<Message | null> {
        const res = await fetchWithAuth(
            `${API_URL}/guild-channels/${channelId}/messages/${messageId}`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            },
            auth
        );

        if (!res.ok) {
            throw new Error("Failed to edit message");
        }

        return res.json();
    }

    // ----------------------------------------------
    // DELETE MESSAGE
    // DELETE /guild-channels/{channelId}/messages/{messageId}
    // ----------------------------------------------
    async function deleteMessage(
        channelId: string,
        messageId: string
    ): Promise<void> {
        const res = await fetchWithAuth(
            `${API_URL}/guild-channels/${channelId}/messages/${messageId}`,
            { method: "DELETE" },
            auth
        );

        if (!res.ok) {
            throw new Error("Failed to delete message");
        }
    }

    return {
        getMessage,
        getChannelMessages,
        createMessage,
        editMessage,
        deleteMessage,
    };
}
