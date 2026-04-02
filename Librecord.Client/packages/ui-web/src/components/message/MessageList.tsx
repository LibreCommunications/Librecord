import { useCallback, useMemo, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { MessageItem } from "./MessageItem";
import { ConfirmModal } from "../ui/ConfirmModal";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";
import type { MessageListProps } from "./MessageListProps";

const START_INDEX = 100_000;
const VIEWPORT_INCREASE = { top: 800, bottom: 400 };

export function MessageList({
    channelId,
    messages,
    loading,
    currentUserId,
    menuOpenId,
    editingId,
    lastReadMessageId,
    setMenuOpenId,
    setEditingId,
    editMessage,
    deleteMessage,
    onPinMessage,
    pinnedMessageIds,
    canManageMessages,
    canAddReactions,
    canSendMessages,
    onReply,
    onStartThread,
    onOpenThread,
    onAddReaction,
    onRemoveReaction,
    getAvatarUrl,
    forceScrollOnNextUpdateRef,
    onLoadMore,
    hasMore,
    loadingMore,
    onMarkAsRead,
}: MessageListProps) {
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const isAtBottomRef = useRef(false);

    // ── firstItemIndex — only changes on prepend (setState-during-render) ──
    const [prevFirstMsgId, setPrevFirstMsgId] = useState(messages[0]?.id);
    const [firstItemIndex, setFirstItemIndex] = useState(Math.max(0, START_INDEX - messages.length));

    if (messages[0]?.id !== prevFirstMsgId) {
        setPrevFirstMsgId(messages[0]?.id);
        setFirstItemIndex(Math.max(0, START_INDEX - messages.length));
    }

    // ── Unread separator — snapshot the last-read message ID once ──
    // Captured when lastReadMessageId first arrives for this channel.
    // Never updated after that, so new messages don't spawn a separator.
    const [frozenLastRead, setFrozenLastRead] = useState<{ channelId: string; messageId: string } | null>(null);

    if (
        channelId &&
        lastReadMessageId &&
        frozenLastRead?.channelId !== channelId
    ) {
        setFrozenLastRead({ channelId, messageId: lastReadMessageId });
    }

    const unreadSepIndex = useMemo(() => {
        if (!frozenLastRead || frozenLastRead.channelId !== channelId) return -1;
        const idx = messages.findIndex(m => m.id === frozenLastRead.messageId);
        if (idx < 0 || idx >= messages.length - 1) return -1;
        return idx + 1;
    }, [frozenLastRead, channelId, messages]);

    // ── rangeChanged — call markAsRead for visible messages ─────
    const handleRangeChanged = useCallback((range: { startIndex: number; endIndex: number }) => {
        if (!channelId || messages.length === 0) return;
        const bottomMsgIndex = Math.min(range.endIndex - firstItemIndex, messages.length - 1);
        const bottomMsg = messages[bottomMsgIndex];
        if (bottomMsg) {
            onMarkAsRead?.(channelId, bottomMsg.id);
        }
    }, [channelId, firstItemIndex, messages, onMarkAsRead]);

    // ── Date separators ──────────────────────────────────────────
    const dateSepIndices = useMemo(() => {
        const result = new Set<number>();
        let prevDate: string | null = null;
        for (let i = 0; i < messages.length; i++) {
            const d = new Date(messages[i].createdAt).toDateString();
            if (d !== prevDate) { result.add(i); prevDate = d; }
        }
        return result;
    }, [messages]);

    // ── Media playing check ─────────────────────────────────────
    const isMediaPlaying = useCallback(() => {
        if (!listRef.current) return false;
        const mediaEls = listRef.current.querySelectorAll("video, audio");
        for (const el of mediaEls) {
            if (!(el as HTMLMediaElement).paused) return true;
        }
        return false;
    }, []);

    // ── followOutput (auto-scroll on new messages) ───────────────
    const msgCountRef = useRef(messages.length);

    const followOutput = useCallback(
        (atBottom: boolean) => {
            if (forceScrollOnNextUpdateRef?.current) {
                forceScrollOnNextUpdateRef.current = false;
                return true;
            }
            const prevCount = msgCountRef.current;
            msgCountRef.current = messages.length;
            if (messages.length <= prevCount) return false;
            if (isMediaPlaying()) return false;
            return atBottom ? true : false;
        },
        [forceScrollOnNextUpdateRef, messages.length, isMediaPlaying],
    );

    // ── Track bottom state + markAsRead ──────────────────────────
    const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
        isAtBottomRef.current = atBottom;
        if (atBottom && channelId && messages.length > 0) {
            onMarkAsRead?.(channelId, messages[messages.length - 1].id);
        }
    }, [channelId, messages, onMarkAsRead]);

    // ── Load more (scroll to top) ────────────────────────────────
    const handleStartReached = useCallback(() => {
        if (hasMore && !loadingMore && onLoadMore) onLoadMore();
    }, [hasMore, loadingMore, onLoadMore]);

    // ── Stable callbacks ─────────────────────────────────────────
    const handleToggleMenu = useCallback(
        (id: string) => setMenuOpenId(prev => (prev === id ? null : id)),
        [setMenuOpenId],
    );
    const handleStartEdit = useCallback(
        (id: string) => setEditingId(id),
        [setEditingId],
    );
    const handleCancelEdit = useCallback(() => setEditingId(null), [setEditingId]);
    const handleDelete = useCallback((id: string) => setDeleteTargetId(id), []);

    const handleScrollToReply = useCallback((targetId: string) => {
        const el = document.querySelector(`[data-testid="message-${targetId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("bg-[#3f4147]/50");
            setTimeout(() => el.classList.remove("bg-[#3f4147]/50"), 1500);
        }
    }, []);

    // ── Render ───────────────────────────────────────────────────
    const renderItem = useCallback(
        (index: number) => {
            const msgIndex = index - firstItemIndex;
            const msg = messages[msgIndex];
            if (!msg) return <div style={{ minHeight: 1 }} />;

            return (
                <div style={{ minHeight: 1 }}>
                    {/* Unread separator */}
                    {msgIndex === unreadSepIndex && (
                        <div className="flex items-center gap-2 px-4 py-1 my-1">
                            <div className="flex-1 h-px bg-[#f23f43]" />
                            <span className="text-xs font-semibold text-[#f23f43] shrink-0 uppercase tracking-wide">
                                New
                            </span>
                            <div className="flex-1 h-px bg-[#f23f43]" />
                        </div>
                    )}
                    {/* Date separator */}
                    {dateSepIndices.has(msgIndex) && (
                        <div className="flex items-center gap-2 px-4 py-2 mt-2">
                            <div className="flex-1 h-px bg-[#3f4147]" />
                            <span className="text-xs font-semibold text-[#949ba4] shrink-0">
                                {new Date(msg.createdAt).toLocaleDateString(undefined, {
                                    weekday: "long", year: "numeric", month: "long", day: "numeric",
                                })}
                            </span>
                            <div className="flex-1 h-px bg-[#3f4147]" />
                        </div>
                    )}
                    <MessageItem
                        msg={msg}
                        isAuthor={msg.author.id === currentUserId}
                        canManageMessages={canManageMessages}
                        canAddReactions={canAddReactions}
                        canSendMessages={canSendMessages}
                        isEditing={editingId === msg.id}
                        menuOpen={menuOpenId === msg.id}
                        currentUserId={currentUserId}
                        onToggleMenu={handleToggleMenu}
                        onStartEdit={handleStartEdit}
                        onReply={onReply}
                        onScrollToReply={handleScrollToReply}
                        onCancelEdit={handleCancelEdit}
                        onDelete={handleDelete}
                        onPin={onPinMessage}
                        onStartThread={onStartThread}
                        onOpenThread={onOpenThread}
                        isPinned={pinnedMessageIds?.has(msg.id)}
                        onAddReaction={onAddReaction}
                        onRemoveReaction={onRemoveReaction}
                        editMessage={editMessage}
                        getAvatarUrl={getAvatarUrl}
                    />
                </div>
            );
        },
        [
            firstItemIndex, messages, currentUserId, dateSepIndices, unreadSepIndex,
            editingId, menuOpenId, pinnedMessageIds, canManageMessages, canAddReactions, canSendMessages,
            handleToggleMenu, handleStartEdit, handleCancelEdit, handleDelete,
            handleScrollToReply, onPinMessage, onStartThread, onOpenThread, onReply,
            onAddReaction, onRemoveReaction, editMessage, getAvatarUrl,
        ],
    );

    const computeItemKey = useCallback(
        (index: number) => {
            const msgIndex = index - firstItemIndex;
            return messages[msgIndex]?.id ?? `placeholder-${index}`;
        },
        [firstItemIndex, messages],
    );

    const headerComponent = useMemo(
        () =>
            function Header() {
                return loadingMore ? (
                    <div className="flex justify-center py-3">
                        <Spinner size="sm" className="text-[#949ba4]" />
                    </div>
                ) : null;
            },
        [loadingMore],
    );

    const headerComponents = useMemo(() => ({ Header: headerComponent }), [headerComponent]);

    // ── Early returns ────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Spinner className="text-[#949ba4]" />
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="flex-1">
                <EmptyState icon="💬" title="No messages yet" description="Send a message to start the conversation!" />
            </div>
        );
    }

    return (
        <div ref={listRef} className="flex-1 relative min-h-0 overflow-hidden" data-testid="message-list" aria-label="Message list">
            <Virtuoso
                key={channelId}
                ref={virtuosoRef}
                className="dark-scrollbar"
                style={{ height: "100%" }}
                totalCount={messages.length}
                firstItemIndex={firstItemIndex}
                alignToBottom
                initialTopMostItemIndex={messages.length - 1}
                itemContent={renderItem}
                computeItemKey={computeItemKey}
                followOutput={followOutput}
                atBottomStateChange={handleAtBottomStateChange}
                atBottomThreshold={60}
                startReached={handleStartReached}
                rangeChanged={handleRangeChanged}
                overscan={1500}
                increaseViewportBy={VIEWPORT_INCREASE}
                components={headerComponents}
            />

            <ConfirmModal
                open={!!deleteTargetId}
                title="Delete Message"
                description="Are you sure you want to delete this message? This cannot be undone."
                confirmLabel="Delete"
                confirmVariant="danger"
                onConfirm={async () => {
                    if (deleteTargetId) await deleteMessage(deleteTargetId);
                    setDeleteTargetId(null);
                }}
                onCancel={() => setDeleteTargetId(null)}
            />
        </div>
    );
}
