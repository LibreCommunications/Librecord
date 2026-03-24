import { useCallback } from "react";
import { uploads, ApiError } from "../api/client";
import type { Message } from "../types/message";

const UPLOAD_TIMEOUT_MS = 60_000; // 60 seconds

export type UploadResult =
    | { ok: true; message: Message }
    | { ok: false; status: number }; // 0 = timeout/network error

export function useAttachmentUpload() {
    const sendGuildMessageWithAttachments = useCallback(async (
        channelId: string,
        content: string,
        clientMessageId: string,
        files: File[]
    ): Promise<UploadResult> => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

        try {
            const message = await uploads.guildMessage(channelId, content, clientMessageId, files, controller.signal);
            return { ok: true, message };
        } catch (err) {
            if (err instanceof ApiError) return { ok: false, status: err.status };
            return { ok: false, status: 0 };
        } finally {
            clearTimeout(timeout);
        }
    }, []);

    const sendDmMessageWithAttachments = useCallback(async (
        channelId: string,
        content: string,
        clientMessageId: string,
        files: File[]
    ): Promise<UploadResult> => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

        try {
            const message = await uploads.dmMessage(channelId, content, clientMessageId, files, controller.signal);
            return { ok: true, message };
        } catch (err) {
            if (err instanceof ApiError) return { ok: false, status: err.status };
            return { ok: false, status: 0 };
        } finally {
            clearTimeout(timeout);
        }
    }, []);

    return { sendGuildMessageWithAttachments, sendDmMessageWithAttachments };
}
