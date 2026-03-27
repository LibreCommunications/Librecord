import { useCallback, useEffect, useRef, useState } from "react";
import { MessageItem } from "./MessageItem";
import { DateSeparator } from "./DateSeparator";
import { ConfirmModal } from "../ui/ConfirmModal";
import { EmptyState } from "../ui/EmptyState";
import { Spinner } from "../ui/Spinner";
import { useVirtualMessageList } from "../../hooks/useVirtualMessageList";
import type { MessageListProps } from "./MessageListProps";

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
                                onAddReaction,
                                onRemoveReaction,
                                getAvatarUrl,
                                forceScrollOnNextUpdateRef,
                                onLoadMore,
                                hasMore,
                                loadingMore,
                            }: MessageListProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const isAtBottomRef = useRef(true);
    const stickyBottomUntilRef = useRef(0);
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [newMsgCount, setNewMsgCount] = useState(0);
    const prevMsgCountRef = useRef(messages.length);
    const [prevMsgLen, setPrevMsgLen] = useState(messages.length);

    const { virtualizer, flatItems } = useVirtualMessageList(messages, containerRef);

    if (messages.length === 0 && prevMsgLen > 0) {
        setPrevMsgLen(0);
        setNewMsgCount(0);
    } else if (messages.length !== prevMsgLen) {
        setPrevMsgLen(messages.length);
    }

    // Scroll position tracking
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        function onScroll() {
            const el = containerRef.current;
            if (!el) return;

            if (Date.now() < stickyBottomUntilRef.current) {
                isAtBottomRef.current = true;
                return;
            }

            const threshold = 20;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
            isAtBottomRef.current = atBottom;

            if (atBottom) setNewMsgCount(0);
        }

        el.addEventListener("scroll", onScroll);
        return () => el.removeEventListener("scroll", onScroll);
    }, []);

    // Media load re-scroll (capture phase for non-bubbling load events)
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        function onMediaLoad(e: Event) {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag !== "IMG" && tag !== "VIDEO") return;
            if (isAtBottomRef.current) {
                el!.scrollTo({ top: el!.scrollHeight, behavior: "instant" });
            }
        }

        el.addEventListener("load", onMediaLoad, true);
        return () => el.removeEventListener("load", onMediaLoad, true);
    }, []);

    // Auto-scroll on new messages / force scroll on send
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        if (forceScrollOnNextUpdateRef?.current) {
            isAtBottomRef.current = true;
            stickyBottomUntilRef.current = Date.now() + 3000;
            requestAnimationFrame(() => {
                el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            });
            forceScrollOnNextUpdateRef.current = false;
            prevMsgCountRef.current = messages.length;
            return;
        }

        if (messages.length === 0) {
            isAtBottomRef.current = true;
            prevMsgCountRef.current = 0;
            return;
        }

        if (loadingMore) {
            prevMsgCountRef.current = messages.length;
            return;
        }

        if (messages.length > prevMsgCountRef.current) {
            if (prevMsgCountRef.current === 0 || isAtBottomRef.current) {
                const isInitial = prevMsgCountRef.current === 0;
                if (isInitial) {
                    stickyBottomUntilRef.current = Date.now() + 3000;
                    requestAnimationFrame(() => {
                        el.scrollTo({ top: el.scrollHeight, behavior: "instant" });
                    });
                } else {
                    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                }
            } else {
                const added = messages.length - prevMsgCountRef.current;
                setNewMsgCount(prev => prev + added);
            }
        }

        prevMsgCountRef.current = messages.length;
    }, [messages, forceScrollOnNextUpdateRef, loadingMore]);

    // Infinite scroll sentinel
    const handleIntersect = useCallback(
        (entries: IntersectionObserverEntry[]) => {
            if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loading && onLoadMore) {
                onLoadMore();
            }
        },
        [hasMore, loadingMore, loading, onLoadMore]
    );

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || !onLoadMore) return;

        const observer = new IntersectionObserver(handleIntersect, {
            root: containerRef.current,
            threshold: 0.1,
        });

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [handleIntersect, onLoadMore]);

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

    const virtualItems = virtualizer.getVirtualItems();

    return (
        <div
            ref={containerRef}
            className="flex-1 overflow-y-auto dark-scrollbar"
        >
            {onLoadMore && hasMore && (
                <div ref={sentinelRef} className="flex justify-center py-3">
                    {loadingMore && <Spinner size="sm" className="text-[#949ba4]" />}
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center py-8">
                    <Spinner className="text-[#949ba4]" />
                </div>
            )}

            {!loading && messages.length === 0 && (
                <EmptyState
                    icon="💬"
                    title="No messages yet"
                    description="Send a message to start the conversation!"
                />
            )}

            {messages.length > 0 && (
                <div
                    style={{
                        height: virtualizer.getTotalSize(),
                        width: "100%",
                        position: "relative",
                    }}
                >
                    {virtualItems.map(virtualRow => {
                        const item = flatItems[virtualRow.index];

                        if (item.type === "separator") {
                            return (
                                <div
                                    key={item.key}
                                    data-index={virtualRow.index}
                                    ref={virtualizer.measureElement}
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        width: "100%",
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    <DateSeparator date={item.date} />
                                </div>
                            );
                        }

                        const msg = item.msg;
                        const isAuthor = msg.author.id === currentUserId;

                        return (
                            <div
                                key={item.key}
                                data-index={virtualRow.index}
                                ref={virtualizer.measureElement}
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                <MessageItem
                                    msg={msg}
                                    isAuthor={isAuthor}
                                    isEditing={editingId === msg.id}
                                    menuOpen={menuOpenId === msg.id}
                                    currentUserId={currentUserId}
                                    onToggleMenu={handleToggleMenu}
                                    onStartEdit={handleStartEdit}
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
                    })}
                </div>
            )}

            {newMsgCount > 0 && (
                <button
                    onClick={() => {
                        containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" });
                        setNewMsgCount(0);
                    }}
                    className="sticky bottom-4 mx-auto flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium shadow-lg transition-colors z-10"
                >
                    {newMsgCount} new message{newMsgCount > 1 ? "s" : ""}
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
