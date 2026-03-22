import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { useDirectMessages } from "../../hooks/useDirectMessages";
import { useDirectMessagesChannel } from "../../hooks/useDirectMessagesChannel";
import { useUserProfile } from "../../hooks/useUserProfile";
import { useAuth } from "../../context/AuthContext";

import { AddParticipantModal } from "./AddParticipantModal";
import { DmHeader } from "./DmHeader";
import { MessageList } from "../../components/message/MessageList";
import { TypingIndicator } from "../../components/messages/TypingIndicator";
import { useTypingIndicator } from "../../hooks/useTypingIndicator";
import { useReactions } from "../../hooks/useReactions";
import { useReadState } from "../../hooks/useReadState";
import { AttachmentUpload } from "../../components/messages/AttachmentUpload";
import { useAttachmentUpload } from "../../hooks/useAttachmentUpload";
import { useToast } from "../../context/ToastContext";

import type { Message } from "../../types/message";
import type { DmEventMap } from "../../realtime/dm/dmEvents";

type OptimisticMessage = Message & {
    clientMessageId?: string;
};

const createClientMessageId = () => crypto.randomUUID();

export default function DmConversationPage() {
    const { dmId } = useParams();
    const navigate = useNavigate();

    const { user } = useAuth();
    const { getAvatarUrl } = useUserProfile();
    const { toast } = useToast();

    const {
        getChannelMessages,
        sendMessage,
        editMessage,
        deleteMessage,
    } = useDirectMessages();

    const { getDmChannel, leaveChannel } = useDirectMessagesChannel();
    const { addReaction, removeReaction } = useReactions();
    const { markAsRead } = useReadState();
    const { sendDmMessageWithAttachments } = useAttachmentUpload();

    const [pendingFiles, setPendingFiles] = useState<File[]>([]);

    const [messages, setMessages] = useState<OptimisticMessage[]>([]);
    const [channel, setChannel] = useState<any>(null);
    const [channelName, setChannelName] = useState<string | null>(null);
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const shouldAutoScrollRef = useRef(false);
    const attachTriggerRef = useRef<{ open: () => void }>(null);

    const { typingNames, sendTyping, stopTyping } = useTypingIndicator(dmId, "dm", user?.userId);

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
        if (!dmId) return;

        const onNewMessage = (
            event: CustomEvent<DmEventMap["dm:message:new"]>
        ) => {
            const { message, clientMessageId } = event.detail;
            if (message.channelId !== dmId) return;

            setMessages(prev =>
                applyNewMessage(prev, message, clientMessageId)
            );

            // Auto-mark as read only if tab is focused
            if (document.hasFocus()) {
                markAsRead(dmId, message.id);
            }
        };

        window.addEventListener("dm:message:new", onNewMessage as EventListener);
        return () =>
            window.removeEventListener(
                "dm:message:new",
                onNewMessage as EventListener
            );
    }, [dmId]);

    /* ------------------------------------------------------------------ */
    /* MARK AS READ WHEN TAB REGAINS FOCUS                                 */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
        if (!dmId) return;

        const onFocus = () => {
            setMessages(prev => {
                if (prev.length > 0) {
                    markAsRead(dmId, prev[prev.length - 1].id);
                }
                return prev;
            });
        };

        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [dmId]);

    /* ------------------------------------------------------------------ */
    /* REALTIME: MESSAGE EDITED                                            */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
        if (!dmId) return;

        const onEdited = (
            event: CustomEvent<DmEventMap["dm:message:edited"]>
        ) => {
            const { channelId, messageId, content, editedAt } = event.detail;
            if (channelId !== dmId) return;

            setMessages(prev =>
                prev.map(m =>
                    m.id === messageId
                        ? { ...m, content, editedAt }
                        : m
                )
            );
        };

        window.addEventListener(
            "dm:message:edited",
            onEdited as EventListener
        );
        return () =>
            window.removeEventListener(
                "dm:message:edited",
                onEdited as EventListener
            );
    }, [dmId]);

    /* ------------------------------------------------------------------ */
    /* REALTIME: MESSAGE DELETED                                           */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
        if (!dmId) return;

        const onDeleted = (
            event: CustomEvent<DmEventMap["dm:message:deleted"]>
        ) => {
            if (event.detail.channelId !== dmId) return;
            setMessages(prev =>
                prev.filter(m => m.id !== event.detail.messageId)
            );
        };

        window.addEventListener(
            "dm:message:deleted",
            onDeleted as EventListener
        );
        return () =>
            window.removeEventListener(
                "dm:message:deleted",
                onDeleted as EventListener
            );
    }, [dmId]);

    /* ------------------------------------------------------------------ */
    /* LOAD CHANNEL + INITIAL MESSAGES                                     */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
        if (!dmId) return;
        let stale = false;

        setLoading(true);
        setMessages([]);
        setChannel(null);
        setChannelName(null);

        Promise.all([getDmChannel(dmId), getChannelMessages(dmId)])
            .then(([channel, msgs]) => {
                if (stale || !channel) return;

                setChannel(channel);

                const others = channel.members.filter(
                    (m: any) => m.id !== user?.userId
                );

                setChannelName(
                    others.length
                        ? others.map((o: any) => o.displayName).join(", ")
                        : "Direct Message"
                );

                const reversed = msgs.slice().reverse();
                setMessages(reversed);
                setHasMore(msgs.length >= 50);

                if (reversed.length > 0 && dmId) {
                    markAsRead(dmId, reversed[reversed.length - 1].id);
                }
            })
            .finally(() => { if (!stale) setLoading(false); });

        return () => { stale = true; };
    }, [dmId]);

    /* ------------------------------------------------------------------ */
    /* SEND MESSAGE (OPTIMISTIC)                                           */
    /* ------------------------------------------------------------------ */

    const handleSend = async () => {
        if (!dmId || (!content.trim() && pendingFiles.length === 0) || !user || sending) return;
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
            channelId: dmId,
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
                const serverMsg = await sendDmMessageWithAttachments(dmId, text, clientMessageId, filesToSend);
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
                    toast("Failed to send file. The upload may have timed out.", "error");
                }
            } else {
                await sendMessage(dmId, text, clientMessageId);
            }
        } catch {
            setMessages(prev =>
                prev.filter(m => m.clientMessageId !== clientMessageId)
            );
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
            await deleteMessage(messageId);
        } catch {}
    };

    const handleEdit = async (messageId: string, dto: { content: string }) => {
        const updated = await editMessage(messageId, dto.content);

        setMessages(prev =>
            prev.map(m =>
                m.id === messageId
                    ? { ...m, content: updated.content, editedAt: updated.editedAt }
                    : m
            )
        );
    };

    const handleLoadMore = async () => {
        if (!dmId || loadingMore || !hasMore || messages.length === 0) return;
        setLoadingMore(true);

        const oldestId = messages[0].id;
        const older = await getChannelMessages(dmId, 50, oldestId);
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
        await addReaction(messageId, emoji);
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

    if (!dmId) return null;

    return (
        <div className="flex-1 flex flex-col bg-[#313338] min-h-0 overflow-hidden">
            <DmHeader
                channelName={channelName}
                isGroup={channel?.isGroup ?? false}
                onAddMember={() => setShowAddModal(true)}
                onLeave={() => setShowLeaveConfirm(true)}
            />

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
                        placeholder={`Message ${channelName ?? ""}`}
                        className="flex-1 resize-none py-2.5 pr-4 bg-transparent text-[#dbdee1] placeholder-[#6d6f78] outline-none disabled:opacity-50"
                    />
                    {content.length > 3800 && (
                        <span className={`text-xs px-2 shrink-0 ${content.length >= 4000 ? "text-[#f23f43]" : "text-[#949ba4]"}`}>
                            {content.length}/4000
                        </span>
                    )}
                </div>
            </div>

            {showAddModal && channel && (
                <AddParticipantModal
                    channelId={channel.id}
                    members={channel.members}
                    onClose={() => setShowAddModal(false)}
                />
            )}

            {showLeaveConfirm && (() => {
                const isLast = channel && channel.members.length <= 1;
                return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowLeaveConfirm(false)}>
                    <div className="bg-[#313338] rounded-lg w-[400px] p-5" onClick={e => e.stopPropagation()}>
                        <h3 className="text-white text-lg font-semibold mb-2">Leave Group</h3>
                        <p className="text-[#949ba4] text-sm mb-5">
                            {isLast
                                ? "You are the last member. Leaving will permanently delete this group and all its messages and attachments."
                                : "Are you sure you want to leave this group? You won't be able to rejoin unless someone adds you back."}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowLeaveConfirm(false)} className="px-4 py-2 text-sm text-[#dbdee1] hover:underline">
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    setShowLeaveConfirm(false);
                                    if (await leaveChannel(dmId)) navigate("/app/dm");
                                }}
                                className="px-4 py-2 text-sm bg-[#da373c] text-white rounded hover:bg-[#a12828] transition-colors"
                            >
                                Leave Group
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
}
