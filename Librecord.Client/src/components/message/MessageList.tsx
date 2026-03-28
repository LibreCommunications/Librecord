import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { MessageItem } from "./MessageItem";
import { ConfirmModal } from "../ui/ConfirmModal";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";
import type { MessageListProps } from "./MessageListProps";

// Virtuoso needs a stable firstItemIndex that decreases as older messages are prepended.
// We start high and subtract as messages grow, so prepended items get lower indices.
const START_INDEX = 100_000;

export function MessageList({
                                messages,
                                loading,
                                currentUserId,
                                menuOpenId,
                                editingId,
                                setMenuOpenId,
                                setEditingId,
                                editMessage,
                                deleteMessage,
                                onPinMessage,
                                pinnedMessageIds,
                                onReply,
                                onAddReaction,
                                onRemoveReaction,
                                getAvatarUrl,
                                forceScrollOnNextUpdateRef,
                                onLoadMore,
                                hasMore,
                                loadingMore,
                            }: MessageListProps) {
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [newMsgCount, setNewMsgCount] = useState(0);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const isAtBottomRef = useRef(true);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const firstItemIndex = useMemo(
        () => Math.max(0, START_INDEX - messages.length),
        [messages.length]
    );

    // Date separator logic: determine which messages start a new day
    const dateSepIndices = useMemo(() => {
        const result = new Set<number>();
        let prevDate: string | null = null;
        for (let i = 0; i < messages.length; i++) {
            const d = new Date(messages[i].createdAt).toDateString();
            if (d !== prevDate) {
                result.add(i);
                prevDate = d;
            }
        }
        return result;
    }, [messages]);

    // Follow output: auto-scroll to bottom when new messages arrive (if at bottom or force)
    const followOutput = useCallback((isAtBottom: boolean) => {
        if (forceScrollOnNextUpdateRef?.current) {
            forceScrollOnNextUpdateRef.current = false;
            return "smooth";
        }
        if (isAtBottom) return "smooth";
        return false;
    }, [forceScrollOnNextUpdateRef]);

    // Track at-bottom state and new message count
    // Debounce hiding the button so image loads don't cause flicker
    const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
        isAtBottomRef.current = atBottom;
        clearTimeout(hideTimerRef.current);
        if (atBottom) {
            hideTimerRef.current = setTimeout(() => setShowScrollBtn(false), 100);
            setNewMsgCount(0);
        } else {
            setShowScrollBtn(true);
        }
    }, []);

    useEffect(() => () => clearTimeout(hideTimerRef.current), []);

    // When Virtuoso detects the user scrolled to the top
    const handleStartReached = useCallback(() => {
        if (hasMore && !loadingMore && onLoadMore) {
            onLoadMore();
        }
    }, [hasMore, loadingMore, onLoadMore]);

    // Stable callbacks for MessageItem
    const handleToggleMenu = useCallback((id: string) => {
        setMenuOpenId(prev => prev === id ? null : id);
    }, [setMenuOpenId]);

    const handleStartEdit = useCallback((id: string) => {
        setEditingId(id);
    }, [setEditingId]);

    const handleCancelEdit = useCallback(() => {
        setEditingId(null);
    }, [setEditingId]);

    const handleDelete = useCallback((id: string) => {
        setDeleteTargetId(id);
    }, []);

    const handleScrollToReply = useCallback((targetId: string) => {
        const idx = messages.findIndex(m => m.id === targetId);
        if (idx >= 0) {
            virtuosoRef.current?.scrollToIndex({
                index: firstItemIndex + idx,
                behavior: "smooth",
                align: "center",
            });
            // Brief highlight flash
            setTimeout(() => {
                const el = document.querySelector(`[data-testid="message-${targetId}"]`);
                if (el) {
                    el.classList.add("bg-[#3f4147]/50");
                    setTimeout(() => el.classList.remove("bg-[#3f4147]/50"), 1500);
                }
            }, 400);
        }
    }, [messages, firstItemIndex]);

    const renderItem = useCallback((index: number) => {
        const msgIndex = index - firstItemIndex;
        const msg = messages[msgIndex];
        if (!msg) return null;

        const isAuthor = msg.author.id === currentUserId;
        const showDateSep = dateSepIndices.has(msgIndex);

        return (
            <div>
                {showDateSep && (
                    <div className="flex items-center gap-2 px-4 py-2 mt-2">
                        <div className="flex-1 h-px bg-[#3f4147]" />
                        <span className="text-xs font-semibold text-[#949ba4] shrink-0">
                            {new Date(msg.createdAt).toLocaleDateString(undefined, {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })}
                        </span>
                        <div className="flex-1 h-px bg-[#3f4147]" />
                    </div>
                )}
                <MessageItem
                    msg={msg}
                    isAuthor={isAuthor}
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
                    isPinned={pinnedMessageIds?.has(msg.id)}
                    onAddReaction={onAddReaction}
                    onRemoveReaction={onRemoveReaction}
                    editMessage={editMessage}
                    getAvatarUrl={getAvatarUrl}
                />
            </div>
        );
    }, [
        firstItemIndex, messages, currentUserId, dateSepIndices,
        editingId, menuOpenId, pinnedMessageIds,
        handleToggleMenu, handleStartEdit, handleCancelEdit, handleDelete, handleScrollToReply,
        onPinMessage, onReply, onAddReaction, onRemoveReaction, editMessage, getAvatarUrl,
    ]);

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
                <EmptyState
                    icon="💬"
                    title="No messages yet"
                    description="Send a message to start the conversation!"
                />
            </div>
        );
    }

    return (
        <div className="flex-1 relative">
            <Virtuoso
                ref={virtuosoRef}
                className="dark-scrollbar"
                style={{ height: "100%" }}
                totalCount={messages.length}
                firstItemIndex={firstItemIndex}
                initialTopMostItemIndex={messages.length - 1}
                itemContent={renderItem}
                followOutput={followOutput}
                atBottomStateChange={handleAtBottomStateChange}
                atBottomThreshold={150}
                startReached={handleStartReached}
                overscan={600}
                increaseViewportBy={{ top: 400, bottom: 200 }}
                components={{
                    Header: () => (
                        loadingMore ? (
                            <div className="flex justify-center py-3">
                                <Spinner size="sm" className="text-[#949ba4]" />
                            </div>
                        ) : null
                    ),
                }}
            />

            {showScrollBtn && (
                <button
                    onClick={() => {
                        virtuosoRef.current?.scrollToIndex({
                            index: messages.length - 1,
                            behavior: "smooth",
                        });
                        setNewMsgCount(0);
                    }}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium shadow-lg transition-colors z-10"
                >
                    {newMsgCount > 0
                        ? <>{newMsgCount} new message{newMsgCount > 1 ? "s" : ""}</>
                        : <>Scroll to bottom</>
                    }
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
            )}

            <ConfirmModal
                open={!!deleteTargetId}
                title="Delete Message"
                description="Are you sure you want to delete this message? This cannot be undone."
                confirmLabel="Delete"
                confirmVariant="danger"
                onConfirm={async () => {
                    if (deleteTargetId) {
                        await deleteMessage(deleteTargetId);
                    }
                    setDeleteTargetId(null);
                }}
                onCancel={() => setDeleteTargetId(null)}
            />
        </div>
    );
}
