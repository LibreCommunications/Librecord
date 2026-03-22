import { useCallback, useEffect, useRef, useState } from "react";
import { dmConnection } from "../realtime/dm/dmConnection";
import { guildConnection } from "../realtime/guild/guildConnection";

const TYPING_THROTTLE_MS = 3000;
const TYPING_EXPIRE_MS = 5000;

type TypingUser = {
    channelId: string;
    userId: string;
    username: string;
    displayName: string;
    expiresAt: number;
};

/**
 * Hook for typing indicators on a channel.
 *
 * @param channelId - current channel
 * @param hub - "dm" or "guild"
 * @param currentUserId - the logged-in user (to exclude self)
 */
export function useTypingIndicator(
    channelId: string | undefined,
    hub: "dm" | "guild",
    currentUserId: string | undefined
) {
    const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
    const lastSentRef = useRef(0);
    const isTypingRef = useRef(false);

    const typingEvent = hub === "dm" ? "dm:user:typing" : "guild:user:typing";
    const stopTypingEvent = hub === "dm" ? "dm:user:stop-typing" : "guild:user:stop-typing";

    // Listen for typing / stop-typing events
    useEffect(() => {
        if (!channelId) return;

        const onTyping = (e: CustomEvent<{ channelId: string; userId: string; username: string; displayName?: string }>) => {
            const { channelId: evtChannel, userId, username, displayName } = e.detail;
            if (evtChannel !== channelId) return;
            if (userId === currentUserId) return;

            setTypingUsers(prev => {
                const now = Date.now();
                const filtered = prev.filter(t => t.expiresAt > now && t.userId !== userId);
                return [...filtered, { channelId, userId, username, displayName: displayName ?? username, expiresAt: now + TYPING_EXPIRE_MS }];
            });
        };

        const onStopTyping = (e: CustomEvent<{ channelId: string; userId: string }>) => {
            const { channelId: evtChannel, userId } = e.detail;
            if (evtChannel !== channelId) return;

            setTypingUsers(prev => prev.filter(t => t.userId !== userId));
        };

        // Clear typing when a message arrives from that user
        const messageEvent = hub === "dm" ? "dm:message:new" : "guild:message:new";
        const onMessage = (e: CustomEvent<{ message: { channelId: string; author: { id: string } } }>) => {
            const { message } = e.detail;
            if (message.channelId !== channelId) return;

            setTypingUsers(prev => prev.filter(t => t.userId !== message.author.id));
        };

        window.addEventListener(typingEvent, onTyping as EventListener);
        window.addEventListener(stopTypingEvent, onStopTyping as EventListener);
        window.addEventListener(messageEvent, onMessage as EventListener);
        return () => {
            window.removeEventListener(typingEvent, onTyping as EventListener);
            window.removeEventListener(stopTypingEvent, onStopTyping as EventListener);
            window.removeEventListener(messageEvent, onMessage as EventListener);
        };
    }, [channelId, currentUserId, typingEvent, stopTypingEvent, hub]);

    // Expire stale typing entries
    useEffect(() => {
        if (typingUsers.length === 0) return;

        const interval = setInterval(() => {
            const now = Date.now();
            setTypingUsers(prev => prev.filter(t => t.expiresAt > now));
        }, 1000);

        return () => clearInterval(interval);
    }, [typingUsers.length]);

    // Stop typing on unmount/channel switch
    useEffect(() => {
        return () => {
            if (isTypingRef.current && channelId) {
                isTypingRef.current = false;
                const connection = hub === "dm" ? dmConnection : guildConnection;
                connection.invoke("StopTyping", channelId).catch(() => {});
            }
        };
    }, [channelId, hub]);

    // Send typing event (throttled)
    const sendTyping = useCallback(() => {
        if (!channelId) return;

        const now = Date.now();
        isTypingRef.current = true;

        if (now - lastSentRef.current < TYPING_THROTTLE_MS) return;
        lastSentRef.current = now;

        const connection = hub === "dm" ? dmConnection : guildConnection;
        connection.invoke("StartTyping", channelId).catch((e) => console.warn("[Typing] SignalR invoke failed:", e));
    }, [channelId, hub]);

    // Send stop typing event (called when input is cleared or message is sent)
    const stopTyping = useCallback(() => {
        if (!channelId || !isTypingRef.current) return;

        isTypingRef.current = false;
        lastSentRef.current = 0; // reset throttle so next keystroke sends immediately

        const connection = hub === "dm" ? dmConnection : guildConnection;
        connection.invoke("StopTyping", channelId).catch((e) => console.warn("[Typing] SignalR invoke failed:", e));
    }, [channelId, hub]);

    // Filter by current channelId so stale typing users from previous channels are excluded
    const typingNames = typingUsers
        .filter(t => t.channelId === channelId)
        .map(t => t.displayName);

    return { typingNames, sendTyping, stopTyping };
}
