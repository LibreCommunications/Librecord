import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { readState } from "@librecord/api-client";
import { onCustomEvent } from "../typedEvent";
import { useAuth } from "../hooks/useAuth";
import type { AppEventMap } from "@librecord/domain";

interface UnreadContextValue {
    counts: Record<string, number>;
    markAsRead: (channelId: string, messageId: string) => void;
    fetchUnreads: (channelIds: string[]) => Promise<void>;
    clearChannel: (channelId: string) => void;
    setActiveChannel: (channelId: string | undefined) => void;
}

const UnreadContext = createContext<UnreadContextValue>({
    counts: {},
    markAsRead: () => {},
    fetchUnreads: async () => {},
    clearChannel: () => {},
    setActiveChannel: () => {},
});

// eslint-disable-next-line react-refresh/only-export-components
export function useUnreadContext() {
    return useContext(UnreadContext);
}

export function UnreadProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [counts, setCounts] = useState<Record<string, number>>({});
    const activeChannelRef = useRef<string | undefined>(undefined);

    // Per-channel debounce timers and latest messageId for markAsRead
    const pendingAcksRef = useRef<Record<string, { messageId: string; timer: ReturnType<typeof setTimeout> }>>({});

    const setActiveChannel = useCallback((channelId: string | undefined) => {
        activeChannelRef.current = channelId;
        if (channelId) {
            setCounts(prev => {
                if (!prev[channelId]) return prev;
                const next = { ...prev };
                delete next[channelId];
                return next;
            });
        }
    }, []);

    const clearChannel = useCallback((channelId: string) => {
        setCounts(prev => {
            if (!prev[channelId]) return prev;
            const next = { ...prev };
            delete next[channelId];
            return next;
        });
    }, []);

    const markAsRead = useCallback((channelId: string, messageId: string) => {
        // Optimistic: clear count immediately
        setCounts(prev => {
            if (!prev[channelId]) return prev;
            const next = { ...prev };
            delete next[channelId];
            return next;
        });

        // Debounce the API call per channel (300ms trailing)
        const pending = pendingAcksRef.current[channelId];
        if (pending) clearTimeout(pending.timer);

        pendingAcksRef.current[channelId] = {
            messageId,
            timer: setTimeout(() => {
                const latest = pendingAcksRef.current[channelId];
                if (latest) {
                    delete pendingAcksRef.current[channelId];
                    readState.markAsRead(channelId, latest.messageId).catch(() => {});
                }
            }, 300),
        };
    }, []);

    const fetchUnreads = useCallback(async (channelIds: string[]) => {
        if (channelIds.length === 0) return;
        const result = await readState.getUnreadCounts(channelIds);
        setCounts(prev => {
            const next = { ...prev };
            for (const [id, count] of Object.entries(result)) {
                if (count > 0) {
                    next[id] = count;
                } else {
                    delete next[id];
                }
            }
            // Never show unreads for the active channel
            const active = activeChannelRef.current;
            if (active && next[active]) delete next[active];
            return next;
        });
    }, []);

    // Listen for message pings and increment unread counts
    useEffect(() => {
        const cleanups = [
            onCustomEvent<AppEventMap["dm:message:ping"]>("dm:message:ping", (detail) => {
                if (detail.authorId === user?.userId) return;
                if (detail.channelId === activeChannelRef.current) return;
                setCounts(prev => ({
                    ...prev,
                    [detail.channelId]: (prev[detail.channelId] ?? 0) + 1,
                }));
            }),
            onCustomEvent<AppEventMap["guild:message:ping"]>("guild:message:ping", (detail) => {
                if (detail.authorId === user?.userId) return;
                if (detail.channelId === activeChannelRef.current) return;
                setCounts(prev => ({
                    ...prev,
                    [detail.channelId]: (prev[detail.channelId] ?? 0) + 1,
                }));
            }),
        ];
        return () => cleanups.forEach(fn => fn());
    }, [user?.userId]);

    // Clean up pending timers on unmount
    useEffect(() => {
        const ref = pendingAcksRef;
        return () => {
            for (const pending of Object.values(ref.current)) {
                clearTimeout(pending.timer);
            }
        };
    }, []);

    return (
        <UnreadContext.Provider value={{ counts, markAsRead, fetchUnreads, clearChannel, setActiveChannel }}>
            {children}
        </UnreadContext.Provider>
    );
}
