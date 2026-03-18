import { useCallback, useEffect, useRef, useState } from "react";
import { dmConnection } from "../realtime/dm/dmConnection";
import { guildConnection } from "../realtime/guild/guildConnection";

const TYPING_THROTTLE_MS = 3000;
const TYPING_EXPIRE_MS = 5000;

type TypingUser = {
    userId: string;
    username: string;
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

    const eventName = hub === "dm" ? "dm:user:typing" : "guild:user:typing";

    // Listen for typing events
    useEffect(() => {
        if (!channelId) return;

        const onTyping = (e: CustomEvent<{ channelId: string; userId: string; username: string }>) => {
            const { channelId: evtChannel, userId, username } = e.detail;
            if (evtChannel !== channelId) return;
            if (userId === currentUserId) return;

            setTypingUsers(prev => {
                const now = Date.now();
                const filtered = prev.filter(t => t.expiresAt > now && t.userId !== userId);
                return [...filtered, { userId, username, expiresAt: now + TYPING_EXPIRE_MS }];
            });
        };

        // Clear typing when a message arrives from that user
        const messageEvent = hub === "dm" ? "dm:message:new" : "guild:message:new";
        const onMessage = (e: CustomEvent<{ message: { channelId: string; author: { id: string } } }>) => {
            const { message } = e.detail;
            if (message.channelId !== channelId) return;

            setTypingUsers(prev => prev.filter(t => t.userId !== message.author.id));
        };

        window.addEventListener(eventName, onTyping as EventListener);
        window.addEventListener(messageEvent, onMessage as EventListener);
        return () => {
            window.removeEventListener(eventName, onTyping as EventListener);
            window.removeEventListener(messageEvent, onMessage as EventListener);
        };
    }, [channelId, currentUserId, eventName, hub]);

    // Expire stale typing entries
    useEffect(() => {
        if (typingUsers.length === 0) return;

        const interval = setInterval(() => {
            const now = Date.now();
            setTypingUsers(prev => prev.filter(t => t.expiresAt > now));
        }, 1000);

        return () => clearInterval(interval);
    }, [typingUsers.length]);

    // Reset when channel changes
    useEffect(() => {
        setTypingUsers([]);
    }, [channelId]);

    // Send typing event (throttled)
    const sendTyping = useCallback(() => {
        if (!channelId) return;

        const now = Date.now();
        if (now - lastSentRef.current < TYPING_THROTTLE_MS) return;
        lastSentRef.current = now;

        const connection = hub === "dm" ? dmConnection : guildConnection;
        connection.invoke("StartTyping", channelId).catch(() => {});
    }, [channelId, hub]);

    const typingNames = typingUsers.map(t => t.username);

    return { typingNames, sendTyping };
}
