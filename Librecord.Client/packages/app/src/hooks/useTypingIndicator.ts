import { useCallback, useEffect, useRef, useState } from "react";
import { appConnection } from "@librecord/api-client";
import { logger } from "@librecord/domain";
import { onCustomEvent } from "../typedEvent";

const TYPING_THROTTLE_MS = 3000;
const TYPING_EXPIRE_MS = 5000;

type TypingUser = {
    channelId: string;
    userId: string;
    username: string;
    displayName: string;
    expiresAt: number;
};

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

    useEffect(() => {
        if (!channelId) return;

        const messageEvent = hub === "dm" ? "dm:message:new" : "guild:message:new";
        const cleanups = [
            onCustomEvent<{ channelId: string; userId: string; username: string; displayName?: string }>(typingEvent, (detail) => {
                const { channelId: evtChannel, userId, username, displayName } = detail;
                if (evtChannel !== channelId) return;
                if (userId === currentUserId) return;

                setTypingUsers(prev => {
                    const now = Date.now();
                    const filtered = prev.filter(t => t.expiresAt > now && t.userId !== userId);
                    return [...filtered, { channelId, userId, username, displayName: displayName ?? username, expiresAt: now + TYPING_EXPIRE_MS }];
                });
            }),
            onCustomEvent<{ channelId: string; userId: string }>(stopTypingEvent, (detail) => {
                const { channelId: evtChannel, userId } = detail;
                if (evtChannel !== channelId) return;

                setTypingUsers(prev => prev.filter(t => t.userId !== userId));
            }),
            onCustomEvent<{ message: { channelId: string; author: { id: string } } }>(messageEvent, (detail) => {
                const { message } = detail;
                if (message.channelId !== channelId) return;

                setTypingUsers(prev => prev.filter(t => t.userId !== message.author.id));
            }),
        ];
        return () => cleanups.forEach(fn => fn());
    }, [channelId, currentUserId, typingEvent, stopTypingEvent, hub]);

    useEffect(() => {
        if (typingUsers.length === 0) return;

        const interval = setInterval(() => {
            const now = Date.now();
            setTypingUsers(prev => prev.filter(t => t.expiresAt > now));
        }, 1000);

        return () => clearInterval(interval);
    }, [typingUsers.length]);

    useEffect(() => {
        return () => {
            if (isTypingRef.current && channelId) {
                isTypingRef.current = false;
                const method = hub === "dm" ? "DmStopTyping" : "GuildStopTyping";
                appConnection.invoke(method, channelId).catch(e => logger.typing.warn("Failed to send stop typing on cleanup", e));
            }
        };
    }, [channelId, hub]);

    const sendTyping = useCallback(() => {
        if (!channelId) return;

        const now = Date.now();
        isTypingRef.current = true;

        if (now - lastSentRef.current < TYPING_THROTTLE_MS) return;
        lastSentRef.current = now;

        const method = hub === "dm" ? "DmStartTyping" : "GuildStartTyping";
        appConnection.invoke(method, channelId).catch(e => logger.typing.warn("SignalR invoke failed", e));
    }, [channelId, hub]);

    const stopTyping = useCallback(() => {
        if (!channelId || !isTypingRef.current) return;

        isTypingRef.current = false;
        lastSentRef.current = 0;

        const method = hub === "dm" ? "DmStopTyping" : "GuildStopTyping";
        appConnection.invoke(method, channelId).catch(e => logger.typing.warn("SignalR invoke failed", e));
    }, [channelId, hub]);

    const typingNames = typingUsers
        .filter(t => t.channelId === channelId)
        .map(t => t.displayName);

    return { typingNames, sendTyping, stopTyping };
}
