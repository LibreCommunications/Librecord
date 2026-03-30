import { useCallback, useEffect, useRef, useState } from "react";
import { ReplyIcon, CloseIcon, PlusIcon } from "../ui/Icons";
import { MessageList } from "../message/MessageList";
import { TypingIndicator } from "../messages/TypingIndicator";
import { AttachmentUpload } from "../messages/AttachmentUpload";
import { useToast } from "../../hooks/useToast";
import type { useChatChannel } from "../../hooks/useChatChannel";

type ChatState = ReturnType<typeof useChatChannel>;

interface ChatViewProps {
    chat: ChatState;
    currentUserId: string | undefined;
    getAvatarUrl: (avatarUrl?: string | null) => string;
    inputPlaceholder: string;
    canManageMessages?: boolean;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export function ChatView({ chat, currentUserId, getAvatarUrl, inputPlaceholder, canManageMessages }: ChatViewProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { toast } = useToast();
    const [dragging, setDragging] = useState(false);
    const dragCounter = useRef(0);

    const handleReject = useCallback((names: string[]) => {
        toast(`${names.join(", ")} exceeds the 25 MB limit.`, "error");
    }, [toast]);

    // Refocus textarea after sending completes (sending flips false → enabled again)
    const wasSendingRef = useRef(false);
    useEffect(() => {
        if (wasSendingRef.current && !chat.sending) {
            // Delay focus until the textarea is re-enabled after the disabled attribute clears
            requestAnimationFrame(() => textareaRef.current?.focus());
        }
        wasSendingRef.current = chat.sending;
    }, [chat.sending]);

    return (
        <div
            className="flex flex-col flex-1 min-h-0 relative"
            onDragEnter={e => { e.preventDefault(); dragCounter.current++; setDragging(true); }}
            onDragLeave={e => { e.preventDefault(); dragCounter.current--; if (dragCounter.current <= 0) { dragCounter.current = 0; setDragging(false); } }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
                e.preventDefault();
                dragCounter.current = 0;
                setDragging(false);
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const accepted: File[] = [];
                    const rejected: string[] = [];
                    for (const f of Array.from(files)) {
                        if (f.size > MAX_FILE_SIZE) rejected.push(f.name);
                        else accepted.push(f);
                    }
                    if (rejected.length) handleReject(rejected);
                    if (accepted.length) chat.setPendingFiles(prev => [...prev, ...accepted]);
                }
            }}
        >
            {dragging && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#5865F2]/20 border-2 border-dashed border-[#5865F2] rounded-lg pointer-events-none" aria-label="Drop files to upload">
                    <span className="text-white text-lg font-medium">Drop files to upload</span>
                </div>
            )}
            <MessageList
                messages={chat.messages}
                loading={chat.loading}
                currentUserId={currentUserId}
                menuOpenId={chat.menuOpenId}
                editingId={chat.editingId}
                setMenuOpenId={chat.setMenuOpenId}
                setEditingId={chat.setEditingId}
                editMessage={chat.handleEdit}
                deleteMessage={chat.handleDelete}
                onPinMessage={chat.handlePin}
                pinnedMessageIds={chat.pinnedIds}
                canManageMessages={canManageMessages}
                onReply={(msgId) => {
                    const msg = chat.messages.find(m => m.id === msgId);
                    if (msg) chat.setReplyingTo(msg);
                }}
                onAddReaction={chat.handleAddReaction}
                onRemoveReaction={chat.handleRemoveReaction}
                getAvatarUrl={getAvatarUrl}
                forceScrollOnNextUpdateRef={chat.shouldAutoScrollRef}
                onLoadMore={chat.handleLoadMore}
                hasMore={chat.hasMore}
                loadingMore={chat.loadingMore}
            />

            {chat.error && (
                <div className="px-4 py-2 bg-[#f23f43]/10 text-[#f23f43] text-sm text-center">
                    {chat.error} — <button onClick={() => window.location.reload()} className="underline">Reload</button>
                </div>
            )}

            <TypingIndicator typingNames={chat.typingNames} />

            <div className="px-4 py-3 shrink-0">
                {chat.replyingTo && (
                    <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-[#2b2d31] rounded-t-lg border-l-2 border-[#5865F2]">
                        <ReplyIcon size={16} className="text-[#5865F2] shrink-0" />
                        <span className="text-xs text-[#949ba4]">Replying to</span>
                        <span className="text-xs font-medium text-[#f2f3f5]">{chat.replyingTo.author.displayName}</span>
                        <span className="text-xs text-[#949ba4] truncate flex-1">{chat.replyingTo.content || "[attachment]"}</span>
                        <button
                            onClick={() => chat.setReplyingTo(null)}
                            className="text-[#949ba4] hover:text-white shrink-0"
                            aria-label="Cancel reply"
                        >
                            <CloseIcon size={16} />
                        </button>
                    </div>
                )}
                <AttachmentUpload files={chat.pendingFiles} onFilesChange={chat.setPendingFiles} onReject={handleReject} triggerRef={chat.attachTriggerRef} />
                {chat.sending && (
                    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-[#949ba4]">
                        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" strokeDasharray="56" strokeDashoffset="14" />
                        </svg>
                        Uploading…
                    </div>
                )}
                <div className="flex items-center bg-[#383a40] rounded-lg">
                    <button
                        onClick={() => chat.attachTriggerRef.current?.open()}
                        className="px-3 py-2.5 text-[#b5bac1] hover:text-[#dbdee1] shrink-0"
                        title="Attach files"
                        aria-label="Attach files"
                        data-testid="attach-files-btn"
                        type="button"
                    >
                        <PlusIcon size={20} />
                    </button>
                    <textarea
                        ref={textareaRef}
                        value={chat.content}
                        disabled={chat.sending}
                        maxLength={4000}
                        rows={1}
                        aria-label="Message input"
                        data-testid="message-input"
                        onChange={e => {
                            chat.setContent(e.target.value);
                            if (e.target.value) chat.sendTyping();
                            else chat.stopTyping();
                        }}
                        onPaste={e => {
                            const files = e.clipboardData.files;
                            if (files.length > 0) {
                                e.preventDefault();
                                const accepted: File[] = [];
                                const rejected: string[] = [];
                                for (const f of Array.from(files)) {
                                    if (f.size > MAX_FILE_SIZE) rejected.push(f.name);
                                    else accepted.push(f);
                                }
                                if (rejected.length) handleReject(rejected);
                                if (accepted.length) chat.setPendingFiles(prev => [...prev, ...accepted]);
                            }
                        }}
                        onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                chat.handleSend();
                            }
                        }}
                        placeholder={inputPlaceholder}
                        className="flex-1 resize-none py-2.5 pr-4 bg-transparent text-[#dbdee1] placeholder-[#6d6f78] outline-none disabled:opacity-50"
                    />
                    {chat.content.length > 3800 && (
                        <span className={`text-xs px-2 shrink-0 ${chat.content.length >= 4000 ? "text-[#f23f43]" : "text-[#949ba4]"}`}>
                            {chat.content.length}/4000
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
