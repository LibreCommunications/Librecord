import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { useReactions } from "./useReactions";
import { useReadState } from "./useReadState";
import { useTypingIndicator } from "./useTypingIndicator";
import { usePins } from "./usePins";
import { useToast } from "./useToast";
import type { Message } from "../types/message";
import type { UploadResult } from "./useAttachmentUpload";

type OptimisticMessage = Message & { clientMessageId?: string };

const MAX_MESSAGES = 500;
const PRUNE_TO = 400;

export interface ChatChannelConfig {
    channelId: string | undefined;

    getMessages: (channelId: string, limit?: number, before?: string) => Promise<Message[]>;
    sendTextMessage: (channelId: string, content: string, clientMessageId: string) => Promise<void>;
    sendWithAttachments: (channelId: string, content: string, clientMessageId: string, files: File[]) => Promise<UploadResult>;
    editMessage: (messageId: string, dto: { content: string }) => Promise<{ content: string; editedAt?: string | null }>;
    deleteMessage: (messageId: string) => Promise<void>;
    events: {
        messageNew: string;
        messageEdited: string;
        messageDeleted: string;
    };

    typingScope: "dm" | "guild";
}

const createClientMessageId = () => crypto.randomUUID();

export function useChatChannel(config: ChatChannelConfig) {
    const { channelId, events } = config;

    const { user } = useAuth();
    const { addReaction, removeReaction } = useReactions();
    const { markAsRead } = useReadState();
    const { pinMessage, unpinMessage, getPins } = usePins();
    const { toast } = useToast();

    const [messages, setMessages] = useState<OptimisticMessage[]>([]);
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showPins, setShowPins] = useState(false);
    const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);

    const shouldAutoScrollRef = useRef(false);
    const attachTriggerRef = useRef<{ open: () => void }>(null);
    const channelIdRef = useRef(channelId);
    const abortRef = useRef<AbortController | null>(null);
    const pruned = useRef(false);
    useEffect(() => { channelIdRef.current = channelId; }, [channelId]);

    useEffect(() => {
        if (pruned.current) {
            pruned.current = false;
            setHasMore(true);
        }
    }, [messages]);

    const { typingNames, sendTyping, stopTyping } = useTypingIndicator(channelId, config.typingScope, user?.userId);

    const [prevChannelId, setPrevChannelId] = useState(channelId);
    if (channelId !== prevChannelId) {
        setPrevChannelId(channelId);
        setLoading(true);
        setError(null);
        setMessages([]);
    }

    useEffect(() => {
        if (!sending) return;
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [sending]);

    const applyNewMessage = useCallback((
        prev: OptimisticMessage[],
        message: Message,
        clientMessageId?: string,
    ): OptimisticMessage[] => {
        if (clientMessageId) {
            const hasOptimistic = prev.some(m => m.clientMessageId === clientMessageId);
            if (hasOptimistic) {
                return prev.map(m =>
                    m.clientMessageId === clientMessageId
                        ? { ...message, clientMessageId }
                        : m
                );
            }
        }
        if (prev.some(m => m.id === message.id)) return prev;
        const next = [...prev, message];
        if (next.length > MAX_MESSAGES) {
            pruned.current = true;
            return next.slice(next.length - PRUNE_TO);
        }
        return next;
    }, []);

    useEffect(() => {
        if (!channelId) return;
        const handler = (event: CustomEvent<{ message: Message; clientMessageId?: string }>) => {
            const { message, clientMessageId } = event.detail;
            if (message.channelId !== channelId) return;
            setMessages(prev => applyNewMessage(prev, message, clientMessageId));
            if (document.hasFocus()) markAsRead(channelId, message.id);
        };
        window.addEventListener(events.messageNew, handler as EventListener);
        return () => window.removeEventListener(events.messageNew, handler as EventListener);
    }, [channelId, events.messageNew, markAsRead, applyNewMessage]);

    useEffect(() => {
        if (!channelId) return;
        const onFocus = () => {
            setMessages(prev => {
                if (prev.length > 0) markAsRead(channelId, prev[prev.length - 1].id);
                return prev;
            });
        };
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [channelId, markAsRead]);

    useEffect(() => {
        if (!channelId) return;
        const handler = (event: CustomEvent<{ channelId: string; messageId: string; content: string; editedAt?: string }>) => {
            const d = event.detail;
            if (d.channelId !== channelId) return;
            setMessages(prev => prev.map(m => m.id === d.messageId ? { ...m, content: d.content, editedAt: d.editedAt } : m));
        };
        window.addEventListener(events.messageEdited, handler as EventListener);
        return () => window.removeEventListener(events.messageEdited, handler as EventListener);
    }, [channelId, events.messageEdited]);

    useEffect(() => {
        if (!channelId) return;
        const handler = (event: CustomEvent<{ channelId: string; messageId: string }>) => {
            if (event.detail.channelId !== channelId) return;
            setMessages(prev => prev.filter(m => m.id !== event.detail.messageId));
        };
        window.addEventListener(events.messageDeleted, handler as EventListener);
        return () => window.removeEventListener(events.messageDeleted, handler as EventListener);
    }, [channelId, events.messageDeleted]);

    useEffect(() => {
        if (!channelId) return;
        const onPinned = (event: CustomEvent<{ channelId: string; messageId: string }>) => {
            if (event.detail.channelId !== channelId) return;
            setPinnedIds(prev => new Set(prev).add(event.detail.messageId));
        };
        const onUnpinned = (event: CustomEvent<{ channelId: string; messageId: string }>) => {
            if (event.detail.channelId !== channelId) return;
            setPinnedIds(prev => { const next = new Set(prev); next.delete(event.detail.messageId); return next; });
        };
        window.addEventListener("channel:message:pinned", onPinned as EventListener);
        window.addEventListener("channel:message:unpinned", onUnpinned as EventListener);
        return () => {
            window.removeEventListener("channel:message:pinned", onPinned as EventListener);
            window.removeEventListener("channel:message:unpinned", onUnpinned as EventListener);
        };
    }, [channelId]);

    useEffect(() => {
        if (!channelId) return;
        const onAdded = (event: CustomEvent<{ channelId: string; messageId: string; userId: string; emoji: string }>) => {
            const { channelId: ch, messageId, userId: reactUserId, emoji } = event.detail;
            if (ch !== channelId || reactUserId === user?.userId) return;
            setMessages(prev => prev.map(m => {
                if (m.id !== messageId) return m;
                if (m.reactions.some(r => r.userId === reactUserId && r.emoji === emoji)) return m;
                return { ...m, reactions: [...m.reactions, { userId: reactUserId, emoji, createdAt: new Date().toISOString() }] };
            }));
        };
        const onRemoved = (event: CustomEvent<{ channelId: string; messageId: string; userId: string; emoji: string }>) => {
            const { channelId: ch, messageId, userId: reactUserId, emoji } = event.detail;
            if (ch !== channelId || reactUserId === user?.userId) return;
            setMessages(prev => prev.map(m =>
                m.id === messageId
                    ? { ...m, reactions: m.reactions.filter(r => !(r.userId === reactUserId && r.emoji === emoji)) }
                    : m
            ));
        };
        window.addEventListener("channel:reaction:added", onAdded as EventListener);
        window.addEventListener("channel:reaction:removed", onRemoved as EventListener);
        return () => {
            window.removeEventListener("channel:reaction:added", onAdded as EventListener);
            window.removeEventListener("channel:reaction:removed", onRemoved as EventListener);
        };
    }, [channelId, user?.userId]);

    useEffect(() => {
        if (!channelId) return;

        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;

        Promise.all([config.getMessages(channelId), getPins(channelId)])
            .then(([msgs, pins]) => {
                if (ac.signal.aborted) return;
                setError(null);
                const reversed = msgs.slice().reverse();
                setMessages(reversed);
                setHasMore(msgs.length >= 50);
                setPinnedIds(new Set(pins.map(p => p.messageId)));
                if (reversed.length > 0) markAsRead(channelId, reversed[reversed.length - 1].id);
            })
            .catch((err) => {
                if (err?.name !== 'AbortError') {
                    console.error(`[useChatChannel] load ERROR for ${channelId}:`, err);
                    setError("Failed to load messages");
                }
            })
            .finally(() => {
                if (!ac.signal.aborted) setLoading(false);
            });

        return () => { ac.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId]);

    const handleSend = async () => {
        if (!channelId || (!content.trim() && pendingFiles.length === 0) || !user) return;
        if (sending && pendingFiles.length > 0) return;
        stopTyping();

        const clientMessageId = createClientMessageId();
        const text = content.trim();
        const filesToSend = [...pendingFiles];

        setContent("");
        setPendingFiles([]);
        setSending(true);
        shouldAutoScrollRef.current = true;

        const optimistic: OptimisticMessage = {
            id: clientMessageId,
            channelId,
            clientMessageId,
            content: text,
            createdAt: new Date().toISOString(),
            editedAt: null,
            author: {
                id: user.userId,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl ?? null,
            },
            attachments: [],
            reactions: [],
            edits: [],
        };

        setMessages(prev => [...prev, optimistic]);

        try {
            if (filesToSend.length > 0) {
                const result = await config.sendWithAttachments(channelId, text, clientMessageId, filesToSend);
                if (result.ok) {
                    setMessages(prev => prev.map(m =>
                        m.clientMessageId === clientMessageId ? { ...result.message, clientMessageId } : m
                    ));
                    shouldAutoScrollRef.current = true;
                } else {
                    setMessages(prev => prev.filter(m => m.clientMessageId !== clientMessageId));
                    setPendingFiles(filesToSend);
                    toast(result.status === 413
                        ? "File exceeds the 25 MB size limit."
                        : "Failed to send file. The upload may have timed out.", "error");
                }
            } else {
                await config.sendTextMessage(channelId, text, clientMessageId);
            }
        } catch {
            setMessages(prev => prev.filter(m => m.clientMessageId !== clientMessageId));
            if (filesToSend.length > 0) setPendingFiles(filesToSend);
            toast("Failed to send message.", "error");
        } finally {
            setSending(false);
        }
    };

    const handleDelete = async (messageId: string) => {
        const snapshot = messages.find(m => m.id === messageId);
        setMessages(prev => prev.filter(m => m.id !== messageId));
        setMenuOpenId(null);
        setEditingId(null);
        try {
            await config.deleteMessage(messageId);
        } catch {
            if (snapshot) setMessages(prev => [...prev, snapshot].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
            toast("Failed to delete message.", "error");
        }
    };

    const handleEdit = async (messageId: string, dto: { content: string }) => {
        try {
            const updated = await config.editMessage(messageId, dto);
            if (!updated) return;
            setMessages(prev => prev.map(m =>
                m.id === messageId ? { ...m, content: updated.content, editedAt: updated.editedAt } : m
            ));
        } catch {
            toast("Failed to edit message.", "error");
        }
    };

    const handleLoadMore = async () => {
        if (!channelId || loadingMore || !hasMore || messages.length === 0) return;
        const fetchForId = channelId;
        setLoadingMore(true);

        const oldestId = messages[0].id;
        const older = await config.getMessages(fetchForId, 50, oldestId);

        if (channelIdRef.current !== fetchForId) { setLoadingMore(false); return; }

        const reversed = older.slice().reverse();
        setMessages(prev => [...reversed, ...prev]);
        setHasMore(older.length >= 50);
        setLoadingMore(false);
    };

    const handleAddReaction = async (messageId: string, emoji: string) => {
        if (!user) return;
        setMessages(prev => prev.map(m => {
            if (m.id !== messageId) return m;
            if (m.reactions.some(r => r.userId === user.userId && r.emoji === emoji)) return m;
            return { ...m, reactions: [...m.reactions, { userId: user.userId, emoji, createdAt: new Date().toISOString() }] };
        }));
        try {
            await addReaction(messageId, emoji);
        } catch {
            setMessages(prev => prev.map(m =>
                m.id === messageId
                    ? { ...m, reactions: m.reactions.filter(r => !(r.userId === user.userId && r.emoji === emoji)) }
                    : m
            ));
        }
    };

    const handleRemoveReaction = async (messageId: string, emoji: string) => {
        if (!user) return;
        setMessages(prev => prev.map(m =>
            m.id === messageId
                ? { ...m, reactions: m.reactions.filter(r => !(r.userId === user.userId && r.emoji === emoji)) }
                : m
        ));
        try {
            await removeReaction(messageId, emoji);
        } catch {
            setMessages(prev => prev.map(m => {
                if (m.id !== messageId) return m;
                return { ...m, reactions: [...m.reactions, { userId: user.userId, emoji, createdAt: new Date().toISOString() }] };
            }));
        }
    };

    const handlePin = async (messageId: string) => {
        if (!channelId) return;
        const isPinned = pinnedIds.has(messageId);
        if (isPinned) {
            setPinnedIds(prev => { const next = new Set(prev); next.delete(messageId); return next; });
        } else {
            setPinnedIds(prev => new Set(prev).add(messageId));
        }
        try {
            if (isPinned) {
                await unpinMessage(channelId, messageId);
            } else {
                await pinMessage(channelId, messageId);
            }
        } catch {
            if (isPinned) {
                setPinnedIds(prev => new Set(prev).add(messageId));
            } else {
                setPinnedIds(prev => { const next = new Set(prev); next.delete(messageId); return next; });
            }
        }
    };

    return {
        messages,
        content, setContent,
        loading,
        error,
        sending,
        menuOpenId, setMenuOpenId,
        editingId, setEditingId,
        showPins, setShowPins,
        pinnedIds,
        hasMore,
        loadingMore,
        pendingFiles, setPendingFiles,
        shouldAutoScrollRef,
        attachTriggerRef,
        typingNames, sendTyping, stopTyping,
        handleSend,
        handleDelete,
        handleEdit,
        handleLoadMore,
        handleAddReaction,
        handleRemoveReaction,
        handlePin,
    };
}
