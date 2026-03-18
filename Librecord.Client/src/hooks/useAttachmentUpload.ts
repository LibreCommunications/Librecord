import { useAuth } from "../context/AuthContext";
import { fetchWithAuth } from "../api/fetchWithAuth";
import type { Message } from "../types/message";

const API_URL = import.meta.env.VITE_API_URL;

export function useAttachmentUpload() {
    const auth = useAuth();

    async function sendGuildMessageWithAttachments(
        channelId: string,
        content: string,
        clientMessageId: string,
        files: File[]
    ): Promise<Message | null> {
        const form = new FormData();
        form.append("content", content);
        form.append("clientMessageId", clientMessageId);
        for (const file of files) {
            form.append("files", file);
        }

        const res = await fetchWithAuth(
            `${API_URL}/guild-channels/${channelId}/messages/with-attachments`,
            { method: "POST", body: form },
            auth
        );
        if (!res.ok) return null;
        return res.json();
    }

    async function sendDmMessageWithAttachments(
        channelId: string,
        content: string,
        clientMessageId: string,
        files: File[]
    ): Promise<Message | null> {
        const form = new FormData();
        form.append("content", content);
        form.append("clientMessageId", clientMessageId);
        for (const file of files) {
            form.append("files", file);
        }

        const res = await fetchWithAuth(
            `${API_URL}/dm-messages/channel/${channelId}/with-attachments`,
            { method: "POST", body: form },
            auth
        );
        if (!res.ok) return null;
        return res.json();
    }

    return { sendGuildMessageWithAttachments, sendDmMessageWithAttachments };
}
