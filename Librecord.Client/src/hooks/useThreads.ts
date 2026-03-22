import { useCallback } from "react";
import { useAuth } from "./useAuth";
import { fetchWithAuth } from "../api/fetchWithAuth";

const API_URL = import.meta.env.VITE_API_URL;

export interface Thread {
    id: string;
    name: string;
    parentMessageId: string;
    creator: { id: string; displayName: string };
    messageCount: number;
    lastMessageAt: string | null;
    createdAt: string;
}

export interface ThreadMessage {
    id: string;
    content: string;
    createdAt: string;
    editedAt: string | null;
    author: { id: string; username: string; displayName: string; avatarUrl: string | null };
}

export function useThreads() {
    const auth = useAuth();

    const createThread = useCallback(async (channelId: string, parentMessageId: string, name: string): Promise<Thread | null> => {
        const res = await fetchWithAuth(`${API_URL}/channels/${channelId}/threads`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parentMessageId, name }),
        }, auth);
        if (!res.ok) return null;
        return res.json();
    }, [auth]);

    const getThreads = useCallback(async (channelId: string): Promise<Thread[]> => {
        const res = await fetchWithAuth(`${API_URL}/channels/${channelId}/threads`, {}, auth);
        if (!res.ok) return [];
        return res.json();
    }, [auth]);

    const getThreadMessages = useCallback(async (channelId: string, threadId: string, limit = 50, before?: string): Promise<ThreadMessage[]> => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (before) params.set("before", before);

        const res = await fetchWithAuth(`${API_URL}/channels/${channelId}/threads/${threadId}/messages?${params}`, {}, auth);
        if (!res.ok) return [];
        return res.json();
    }, [auth]);

    const postThreadMessage = useCallback(async (channelId: string, threadId: string, content: string): Promise<ThreadMessage | null> => {
        const res = await fetchWithAuth(`${API_URL}/channels/${channelId}/threads/${threadId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
        }, auth);
        if (!res.ok) return null;
        return res.json();
    }, [auth]);

    return { createThread, getThreads, getThreadMessages, postThreadMessage };
}
