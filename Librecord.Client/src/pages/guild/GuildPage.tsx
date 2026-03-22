import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import { useChannels } from "../../hooks/useChannels";
import { useGuildChannelMessages } from "../../hooks/useGuildChannelMessages";
import { useUserProfile } from "../../hooks/useUserProfile";

import { MessageList } from "../../components/message/MessageList";
import { MemberSidebar } from "../../components/guild/MemberSidebar";
import { InviteModal } from "../../components/guild/InviteModal";
import { TypingIndicator } from "../../components/messages/TypingIndicator";
import { useTypingIndicator } from "../../hooks/useTypingIndicator";
import { useReactions } from "../../hooks/useReactions";
import { useReadState } from "../../hooks/useReadState";
import { SearchBar } from "../../components/messages/SearchBar";
import { PinnedMessagesPanel } from "../../components/messages/PinnedMessagesPanel";
import { AttachmentUpload } from "../../components/messages/AttachmentUpload";
import { useAttachmentUpload } from "../../hooks/useAttachmentUpload";
import { usePins } from "../../hooks/usePins";
import { VoiceChannelView } from "../../components/voice/VoiceChannelView";
import { useToast } from "../../hooks/useToast";

import type { Message } from "../../types/message";
import type { GuildEventMap } from "../../realtime/guild/guildEvents";

type OptimisticMessage = Message & {
    clientMessageId?: string;
};

const createClientMessageId = () => crypto.randomUUID();

export default function GuildChannelPage() {
    const { guildId, channelId } = useParams<{ guildId: string; channelId: string }>();

    const { user } = useAuth();
    const { getAvatarUrl } = useUserProfile();
    const { toast } = useToast();
    const { getChannel } = useChannels();

    const {
        getChannelMessages,
        createMessage,
        editMessage,
        deleteMessage,
    } = useGuildChannelMessages();
    const { addReaction, removeReaction } = useReactions();
    const { markAsRead } = useReadState();
    const { sendGuildMessageWithAttachments } = useAttachmentUpload();
    const { pinMessage, unpinMessage, getPins } = usePins();

    const [pendingFiles, setPendingFiles] = useState<File[]>([]);

    const [messages, setMessages] = useState<OptimisticMessage[]>([]);
    const [channelName, setChannelName] = useState<string | null>(null);
    const [channelTopic, setChannelTopic] = useState<string | null>(null);
    const [channelType, setChannelType] = useState<number>(0);
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showInvite, setShowInvite] = useState(false);
    const [showMembers, setShowMembers] = useState(true);
    const [showPins, setShowPins] = useState(false);
    const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const shouldAutoScrollRef = useRef(false);
    const attachTriggerRef = useRef<{ open: () => void }>(null);

    const { typingNames, sendTyping, stopTyping } = useTypingIndicator(channelId, "guild", user?.userId);

    // Warn before leaving page while uploading (#36)
    useEffect(() => {
        if (!sending) return;
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [sending]);

    /* ------------------------------------------------------------------ */
    /* Realtime helpers                                                    */
    /* ------------------------------------------------------------------ */

    const applyNewMessage = (
        prev: OptimisticMessage[],
        message: Message,
        clientMessageId?: string
    ) => {
        if (clientMessageId) {
            const hasOptimistic = prev.some(
                m => m.clientMessageId === clientMessageId
            );

            if (hasOptimistic) {
                return prev.map(m =>
                    m.clientMessageId === clientMessageId
                        ? { ...message, clientMessageId }
                        : m
                );
            }
        }

        if (prev.some(m => m.id === message.id)) {
            return prev;
        }

        return [...prev, message];
    };

    /* ------------------------------------------------------------------ */
    /* REALTIME: MESSAGE CREATED                                           */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
        if (!channelId) return;

        const onNewMessage = (
            event: CustomEvent<GuildEventMap["guild:message:new"]>
        ) => {
            const { message, clientMessageId } = event.detail;
            if (message.channelId !== channelId) return;

            setMessages(prev =>
                applyNewMessage(prev, message, clientMessageId)
            );

            // Auto-mark as read only if tab is focused
            if (document.hasFocus()) {
                markAsRead(channelId, message.id);
            }
        };

        window.addEventListener("guild:message:new", onNewMessage as EventListener);
        return () =>
            window.removeEventListener(
                "guild:message:new",
                onNewMessage as EventListener
            );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId]);

    /* ------------------------------------------------------------------ */
    /* MARK AS READ WHEN TAB REGAINS FOCUS                                 */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
        if (!channelId) return;

        const onFocus = () => {
            setMessages(prev => {
                if (prev.length > 0) {
                    markAsRead(channelId, prev[prev.length - 1].id);
                }
                return prev;
            });
        };

        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId]);

    /* ------------------------------------------------------------------ */
    /* REALTIME: MESSAGE EDITED                                            */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
        if (!channelId) return;

        const onEdited = (
            event: CustomEvent<GuildEventMap["guild:message:edited"]>
        ) => {
            const { channelId: evtChannel, messageId, content, editedAt } = event.detail;
            if (evtChannel !== channelId) return;

            setMessages(prev =>
                prev.map(m =>
                    m.id === messageId
                        ? { ...m, content, editedAt }
                        : m
                )
            );
        };

        window.addEventListener(
            "guild:message:edited",
            onEdited as EventListener
        );
        return () =>
            window.removeEventListener(
                "guild:message:edited",
                onEdited as EventListener
            );
    }, [channelId]);

    /* ------------------------------------------------------------------ */
    /* REALTIME: MESSAGE DELETED                                           */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
        if (!channelId) return;

        const onDeleted = (
            event: CustomEvent<GuildEventMap["guild:message:deleted"]>
        ) => {
            if (event.detail.channelId !== channelId) return;
            setMessages(prev =>
                prev.filter(m => m.id !== event.detail.messageId)
            );
        };

        window.addEventListener(
            "guild:message:deleted",
            onDeleted as EventListener
        );
        return () =>
            window.removeEventListener(
                "guild:message:deleted",
                onDeleted as EventListener
            );
    }, [channelId]);

    /* ------------------------------------------------------------------ */
    /* REALTIME: PIN / UNPIN                                                */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
        if (!channelId) return;

        const onPinned = (event: CustomEvent<GuildEventMap["channel:message:pinned"]>) => {
            if (event.detail.channelId !== channelId) return;
            setPinnedIds(prev => new Set(prev).add(event.detail.messageId));
        };

        const onUnpinned = (event: CustomEvent<GuildEventMap["channel:message:unpinned"]>) => {
            if (event.detail.channelId !== channelId) return;
            setPinnedIds(prev => {
                const next = new Set(prev);
                next.delete(event.detail.messageId);
                return next;
            });
        };

        window.addEventListener("channel:message:pinned", onPinned as EventListener);
        window.addEventListener("channel:message:unpinned", onUnpinned as EventListener);
        return () => {
            window.removeEventListener("channel:message:pinned", onPinned as EventListener);
            window.removeEventListener("channel:message:unpinned", onUnpinned as EventListener);
        };
    }, [channelId]);

    /* ------------------------------------------------------------------ */
    /* LOAD CHANNEL + INITIAL MESSAGES                                     */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
        if (!channelId) return;
        let stale = false;

        setLoading(true);
        setMessages([]);
        setChannelName(null);
        setChannelTopic(null);

        Promise.all([
            getChannel(channelId),
            getChannelMessages(channelId),
            getPins(channelId),
        ])
            .then(([channel, msgs, pins]) => {
                if (stale) return;
                setChannelName(channel?.name ?? null);
                setChannelTopic(channel?.topic ?? null);
                setChannelType(channel?.type ?? 0);
                const reversed = msgs.slice().reverse();
                setMessages(reversed);
                setHasMore(msgs.length >= 50);
                setPinnedIds(new Set(pins.map(p => p.messageId)));

                if (reversed.length > 0 && channelId) {
                    markAsRead(channelId, reversed[reversed.length - 1].id);
                }
            })
            .finally(() => { if (!stale) setLoading(false); });

        return () => { stale = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId]);

    /* ------------------------------------------------------------------ */
    /* SEND MESSAGE (OPTIMISTIC)                                           */
    /* ------------------------------------------------------------------ */

    const handleSend = async () => {
        if (!channelId || (!content.trim() && pendingFiles.length === 0) || !user || sending) return;
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
                const serverMsg = await sendGuildMessageWithAttachments(channelId, text, clientMessageId, filesToSend);
                if (serverMsg) {
                    setMessages(prev => prev.map(m =>
                        m.clientMessageId === clientMessageId ? { ...serverMsg, clientMessageId } : m
                    ));
                    // Re-scroll after attachments are rendered
                    shouldAutoScrollRef.current = true;
                } else {
                    setMessages(prev =>
                        prev.filter(m => m.clientMessageId !== clientMessageId)
                    );
                    setPendingFiles(filesToSend);
                    toast("Failed to send file. The upload may have timed out.", "error");
                }
            } else {
                await createMessage(channelId, text, clientMessageId);
            }
        } catch {
            setMessages(prev =>
                prev.filter(m => m.clientMessageId !== clientMessageId)
            );
            if (filesToSend.length > 0) setPendingFiles(filesToSend);
            toast("Failed to send message.", "error");
        } finally {
            setSending(false);
        }
    };

    /* ------------------------------------------------------------------ */
    /* DELETE & EDIT                                                       */
    /* ------------------------------------------------------------------ */

    const handleDelete = async (messageId: string) => {
        setMessages(prev => prev.filter(m => m.id !== messageId));
        setMenuOpenId(null);
        setEditingId(null);

        try {
            await deleteMessage(channelId!, messageId);
        } catch {
            // Optimistic delete — ignore server errors
        }
    };

    const handlePin = async (messageId: string) => {
        if (!channelId) return;
        const isPinned = pinnedIds.has(messageId);
        if (isPinned) {
            await unpinMessage(channelId, messageId);
            setPinnedIds(prev => { const next = new Set(prev); next.delete(messageId); return next; });
        } else {
            await pinMessage(channelId, messageId);
            setPinnedIds(prev => new Set(prev).add(messageId));
        }
    };

    const handleEdit = async (messageId: string, dto: { content: string }) => {
        const updated = await editMessage(channelId!, messageId, dto.content);
        if (!updated) return;

        setMessages(prev =>
            prev.map(m =>
                m.id === messageId
                    ? { ...m, content: updated.content, editedAt: updated.editedAt }
                    : m
            )
        );
    };

    const handleLoadMore = async () => {
        if (!channelId || loadingMore || !hasMore || messages.length === 0) return;
        setLoadingMore(true);

        const oldestId = messages[0].id;
        const older = await getChannelMessages(channelId, 50, oldestId);
        const reversed = older.slice().reverse();

        setMessages(prev => [...reversed, ...prev]);
        setHasMore(older.length >= 50);
        setLoadingMore(false);
    };

    const handleAddReaction = async (messageId: string, emoji: string) => {
        if (!user) return;
        setMessages(prev =>
            prev.map(m => {
                if (m.id !== messageId) return m;
                if (m.reactions.some(r => r.userId === user.userId && r.emoji === emoji)) return m;
                return { ...m, reactions: [...m.reactions, { userId: user.userId, emoji, createdAt: new Date().toISOString() }] };
            })
        );
        try {
            await addReaction(messageId, emoji);
        } catch {
            // Rollback optimistic reaction
            setMessages(prev =>
                prev.map(m =>
                    m.id === messageId
                        ? { ...m, reactions: m.reactions.filter(r => !(r.userId === user.userId && r.emoji === emoji)) }
                        : m
                )
            );
        }
    };

    const handleRemoveReaction = async (messageId: string, emoji: string) => {
        if (!user) return;
        setMessages(prev =>
            prev.map(m =>
                m.id === messageId
                    ? { ...m, reactions: m.reactions.filter(r => !(r.userId === user.userId && r.emoji === emoji)) }
                    : m
            )
        );
        await removeReaction(messageId, emoji);
    };

    if (!channelId) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-400">
                Select a channel
            </div>
        );
    }

    const isVoice = channelType === 1;

    return (
        <div className="flex-1 flex bg-[#313338] overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
                {/* HEADER */}
                <div className="h-12 flex items-center justify-between border-b border-black/20 px-4 shrink-0">
                    <span className="font-semibold flex items-center gap-1.5">
                        {isVoice ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                            </svg>
                        ) : (
                            <span className="text-gray-400">#</span>
                        )}
                        {channelName ?? "channel"}
                    </span>
                    {channelTopic && (
                        <>
                            <div className="w-px h-5 bg-[#3f4147] mx-2" />
                            <span className="text-sm text-[#949ba4] truncate max-w-xs" title={channelTopic}>
                                {channelTopic}
                            </span>
                        </>
                    )}
                    <div className="flex-1" />
                    <div className="flex items-center gap-0.5">
                        {/* Invite */}
                        <button
                            onClick={() => setShowInvite(true)}
                            className="p-2 rounded hover:bg-white/10 text-gray-400 hover:text-white"
                            title="Invite People"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="8.5" cy="7" r="4" />
                                <line x1="20" y1="8" x2="20" y2="14" />
                                <line x1="23" y1="11" x2="17" y2="11" />
                            </svg>
                        </button>

                        {/* Pins (text channels only) */}
                        {!isVoice && (
                            <button
                                onClick={() => setShowPins(v => !v)}
                                className={`p-2 rounded hover:bg-white/10 ${showPins ? "text-white" : "text-gray-400 hover:text-white"}`}
                                title="Pinned Messages"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="17" x2="12" y2="22" />
                                    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                                </svg>
                            </button>
                        )}

                        {/* Members toggle */}
                        <button
                            onClick={() => setShowMembers(v => !v)}
                            className={`p-2 rounded hover:bg-white/10 ${showMembers ? "text-white" : "text-gray-400 hover:text-white"}`}
                            title={showMembers ? "Hide Members" : "Show Members"}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </button>

                        {/* Channel Permissions */}
                        {guildId && channelId && (
                            <Link
                                to={`/app/guild/${guildId}/${channelId}/permissions`}
                                className="p-2 rounded hover:bg-white/10 text-gray-400 hover:text-white"
                                title="Channel Permissions"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                            </Link>
                        )}

                        {/* Settings */}
                        {guildId && (
                            <Link
                                to={`/app/guild/${guildId}/settings`}
                                className="p-2 rounded hover:bg-white/10 text-gray-400 hover:text-white"
                                title="Server Settings"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                </svg>
                            </Link>
                        )}

                        {!isVoice && !showPins && <SearchBar channelId={channelId} guildId={guildId} />}
                    </div>
                </div>

                {/* CONTENT: voice grid or text messages */}
                {isVoice ? (
                    <VoiceChannelView
                        channelId={channelId}
                        channelName={channelName ?? "Voice Channel"}
                    />
                ) : (
                    <>
                        <MessageList
                            messages={messages}
                            loading={loading}
                            currentUserId={user?.userId}
                            menuOpenId={menuOpenId}
                            editingId={editingId}
                            setMenuOpenId={setMenuOpenId}
                            setEditingId={setEditingId}
                            editMessage={handleEdit}
                            deleteMessage={handleDelete}
                            onPinMessage={handlePin}
                            pinnedMessageIds={pinnedIds}
                            onAddReaction={handleAddReaction}
                            onRemoveReaction={handleRemoveReaction}
                            getAvatarUrl={getAvatarUrl}
                            forceScrollOnNextUpdate={shouldAutoScrollRef}
                            onLoadMore={handleLoadMore}
                            hasMore={hasMore}
                            loadingMore={loadingMore}
                        />

                        <TypingIndicator typingNames={typingNames} />

                        <div className="px-4 py-3 shrink-0">
                            <AttachmentUpload files={pendingFiles} onFilesChange={setPendingFiles} triggerRef={attachTriggerRef} />
                            {sending && (
                                <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-[#949ba4]">
                                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <circle cx="12" cy="12" r="10" strokeDasharray="56" strokeDashoffset="14" />
                                    </svg>
                                    Uploading…
                                </div>
                            )}
                            <div className="flex items-center bg-[#383a40] rounded-lg">
                                <button
                                    onClick={() => attachTriggerRef.current?.open()}
                                    className="px-3 py-2.5 text-[#b5bac1] hover:text-[#dbdee1] shrink-0"
                                    title="Attach files"
                                    type="button"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="16" />
                                        <line x1="8" y1="12" x2="16" y2="12" />
                                    </svg>
                                </button>
                                <textarea
                                    value={content}
                                    disabled={sending}
                                    maxLength={4000}
                                    rows={1}
                                    onChange={e => {
                                        setContent(e.target.value);
                                        if (e.target.value) sendTyping();
                                        else stopTyping();
                                    }}
                                    onKeyDown={e => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    placeholder={`Message #${channelName ?? ""}`}
                                    className="flex-1 resize-none py-2.5 pr-4 bg-transparent text-[#dbdee1] placeholder-[#6d6f78] outline-none disabled:opacity-50"
                                />
                                {content.length > 3800 && (
                                    <span className={`text-xs px-2 shrink-0 ${content.length >= 4000 ? "text-[#f23f43]" : "text-[#949ba4]"}`}>
                                        {content.length}/4000
                                    </span>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* PINNED MESSAGES */}
            {showPins && !isVoice && channelId && (
                <PinnedMessagesPanel channelId={channelId} onClose={() => setShowPins(false)} />
            )}

            {/* MEMBER SIDEBAR */}
            {showMembers && guildId && (
                <MemberSidebar guildId={guildId} />
            )}

            {/* INVITE MODAL */}
            {showInvite && guildId && (
                <InviteModal
                    guildId={guildId}
                    onClose={() => setShowInvite(false)}
                />
            )}
        </div>
    );
}
