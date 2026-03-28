import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { MessageItem } from "./MessageItem";
import { ConfirmModal } from "../ui/ConfirmModal";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";
import type { MessageListProps } from "./MessageListProps";

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
    canManageMessages,
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
    const prevMsgCountRef = useRef(messages.length);

    const firstItemIndex = useMemo(
        () => Math.max(0, START_INDEX - messages.length),
        [messages.length],
    );

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

    // ── Auto-scroll on new messages ──────────────────────────────
    const followOutput = useCallback(
        (atBottom: boolean) => {
            if (forceScrollOnNextUpdateRef?.current) {
                forceScrollOnNextUpdateRef.current = false;
                return true;
            }
            return atBottom ? true : false;
        },
        [forceScrollOnNextUpdateRef],
    );

    // ── Track bottom state + new-message badge ───────────────────
    const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
        isAtBottomRef.current = atBottom;
        if (atBottom) {
            setShowScrollBtn(false);
            setNewMsgCount(0);
        }
    }, []);

    // Show scroll button when user is not at bottom and new messages arrive
    useEffect(() => {
        if (messages.length > prevMsgCountRef.current && !isAtBottomRef.current) {
            const delta = messages.length - prevMsgCountRef.current;
            setNewMsgCount(n => n + delta);
            setShowScrollBtn(true);
        }
        prevMsgCountRef.current = messages.length;
    }, [messages.length]);

    // Also show scroll button on any scroll away from bottom (via Virtuoso callback)
    // We use a small delay so fast scroll-past doesn't flicker
    const scrollCheckTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => () => clearTimeout(scrollCheckTimer.current), []);

    const handleScroll = useCallback(() => {
        clearTimeout(scrollCheckTimer.current);
        if (!isAtBottomRef.current && !showScrollBtn) {
            scrollCheckTimer.current = setTimeout(() => {
                if (!isAtBottomRef.current) setShowScrollBtn(true);
            }, 300);
        }
    }, [showScrollBtn]);

    // ── Scroll to bottom ─────────────────────────────────────────
    const scrollToBottom = useCallback(() => {
        virtuosoRef.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: "smooth" });
        setNewMsgCount(0);
    }, []);

    // Snap to bottom after initial load by targeting the Virtuoso scroller directly
    const hasSnapped = useRef(false);
    useEffect(() => {
        if (loading) { hasSnapped.current = false; return; }
        if (hasSnapped.current || messages.length === 0) return;
        hasSnapped.current = true;

        // Find the actual scroll container Virtuoso creates and force it to bottom
        const el = virtuosoRef.current;
        if (!el) return;

        // Poll until the scroller has content, then snap
        let attempts = 0;
        const poll = setInterval(() => {
            attempts++;
            el.scrollTo({ top: Number.MAX_SAFE_INTEGER });
            if (attempts >= 10) clearInterval(poll);
        }, 100);
        return () => clearInterval(poll);
    }, [loading, messages.length]);

    // ESC hotkey
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !isAtBottomRef.current) scrollToBottom();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [scrollToBottom]);

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
            if (!msg) return null;

            return (
                <div>
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
        },
        [
            firstItemIndex, messages, currentUserId, dateSepIndices,
            editingId, menuOpenId, pinnedMessageIds, canManageMessages,
            handleToggleMenu, handleStartEdit, handleCancelEdit, handleDelete,
            handleScrollToReply, onPinMessage, onReply,
            onAddReaction, onRemoveReaction, editMessage, getAvatarUrl,
        ],
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
        <div className="flex-1 relative min-h-0 overflow-hidden">
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
                atBottomThreshold={60}
                startReached={handleStartReached}
                onScroll={handleScroll}
                overscan={400}
                increaseViewportBy={{ top: 200, bottom: 100 }}
                components={{ Header: headerComponent }}
            />

            {showScrollBtn && (
                <button
                    onClick={scrollToBottom}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium shadow-lg transition-colors z-10"
                >
                    {newMsgCount > 0
                        ? <>{newMsgCount} new message{newMsgCount > 1 ? "s" : ""}</>
                        : <>Scroll to bottom</>}
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
                    if (deleteTargetId) await deleteMessage(deleteTargetId);
                    setDeleteTargetId(null);
                }}
                onCancel={() => setDeleteTargetId(null)}
            />
        </div>
    );
}
