import { useAuth } from "../context/AuthContext";
import { fetchWithAuth } from "../api/fetchWithAuth";
import type {Message, TransportMessage} from "../types/message";

const API_URL = import.meta.env.VITE_API_URL;


// --------------------------------------------------
// TRANSPORT → UI MAPPER
// --------------------------------------------------
function mapTransportToUi(msg: TransportMessage): Message {
    return {
        id: msg.id,
        channelId: msg.channelId,
        
        content: msg.content,
        createdAt: msg.createdAt,
        editedAt: msg.editedAt ?? null,

        author: msg.author,

        attachments: msg.attachments,
        reactions: msg.reactions,
        edits: msg.edits,
    };
}



// --------------------------------------------------
// DIRECT MESSAGES HOOK
// --------------------------------------------------
export function useDirectMessages() {
    const auth = useAuth();

    // --------------------------------------------------
    // GET CHANNEL MESSAGES
    // GET /dm-messages/channel/{channelId}
    // --------------------------------------------------
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
            `${API_URL}/dm-messages/channel/${channelId}?${params}`,
            {},
            auth
        );

        if (!res.ok) return [];

        const data: TransportMessage[] = await res.json();
        return data.map(mapTransportToUi);
    }

    // --------------------------------------------------
    // SEND MESSAGE
    // POST /dm-messages/channel/{channelId}
    // --------------------------------------------------
    async function sendMessage(
        channelId: string,
        content: string,
        clientMessageId: string
    ): Promise<void> {
        const res = await fetchWithAuth(
            `${API_URL}/dm-messages/channel/${channelId}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content,           
                    clientMessageId,
                }),
            },
            auth
        );

        if (!res.ok) {
            throw new Error("Failed to send message");
        }
    }




    // --------------------------------------------------
    // EDIT MESSAGE
    // PUT /dm-messages/{messageId}
    // --------------------------------------------------
    async function editMessage(
        messageId: string,
        content: string
    ): Promise<Message> {
        const res = await fetchWithAuth(
            `${API_URL}/dm-messages/${messageId}`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content, 
                }),
            },
            auth
        );

        if (!res.ok) {
            throw new Error("Failed to edit message");
        }

        const msg: TransportMessage = await res.json();
        return mapTransportToUi(msg);
    }


    // --------------------------------------------------
    // DELETE MESSAGE
    // DELETE /dm-messages/{messageId}
    // --------------------------------------------------
    async function deleteMessage(messageId: string): Promise<void> {
        const res = await fetchWithAuth(
            `${API_URL}/dm-messages/${messageId}`,
            { method: "DELETE" },
            auth
        );

        if (!res.ok) {
            throw new Error("Failed to delete message");
        }
    }

    return {
        getChannelMessages,
        sendMessage,
        editMessage,
        deleteMessage,
    };
}
