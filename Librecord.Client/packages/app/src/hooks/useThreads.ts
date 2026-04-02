import { useCallback } from "react";
import { threads } from "@librecord/api-client";
import type { Thread, ThreadMessage } from "@librecord/domain";

export type { Thread, ThreadMessage };

export function useThreads() {

    const createThread = useCallback(
        (channelId: string, parentMessageId: string, name: string): Promise<Thread | null> =>
            threads.create(channelId, parentMessageId, name),
        [],
    );

    const getThreads = useCallback(
        (channelId: string): Promise<Thread[]> => threads.list(channelId),
        [],
    );

    const getThreadMessages = useCallback(
        (channelId: string, threadId: string, limit = 50, before?: string): Promise<ThreadMessage[]> =>
            threads.messages(channelId, threadId, limit, before),
        [],
    );

    const postThreadMessage = useCallback(
        (channelId: string, threadId: string, content: string): Promise<ThreadMessage | null> =>
            threads.postMessage(channelId, threadId, content),
        [],
    );

    return { createThread, getThreads, getThreadMessages, postThreadMessage };
}
