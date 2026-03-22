import { useAuth } from "../context/AuthContext";
import { fetchWithAuth } from "../api/fetchWithAuth";
import type { Message } from "../types/message";

const API_URL = import.meta.env.VITE_API_URL;
const UPLOAD_TIMEOUT_MS = 60_000; // 60 seconds

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

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

        try {
            const res = await fetchWithAuth(
                `${API_URL}/guild-channels/${channelId}/messages/with-attachments`,
                { method: "POST", body: form, signal: controller.signal },
                auth
            );
            if (!res.ok) return null;
            return res.json();
        } finally {
            clearTimeout(timeout);
        }
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

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

        try {
            const res = await fetchWithAuth(
                `${API_URL}/dm-messages/channel/${channelId}/with-attachments`,
                { method: "POST", body: form, signal: controller.signal },
                auth
            );
            if (!res.ok) return null;
            return res.json();
        } finally {
            clearTimeout(timeout);
        }
    }

    return { sendGuildMessageWithAttachments, sendDmMessageWithAttachments };
}
