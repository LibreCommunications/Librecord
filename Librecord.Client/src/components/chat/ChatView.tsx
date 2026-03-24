import { MessageList } from "../message/MessageList";
import { TypingIndicator } from "../messages/TypingIndicator";
import { AttachmentUpload } from "../messages/AttachmentUpload";
import type { useChatChannel } from "../../hooks/useChatChannel";

type ChatState = ReturnType<typeof useChatChannel>;

interface ChatViewProps {
    chat: ChatState;
    currentUserId: string | undefined;
    getAvatarUrl: (avatarUrl?: string | null) => string;
    inputPlaceholder: string;
}

export function ChatView({ chat, currentUserId, getAvatarUrl, inputPlaceholder }: ChatViewProps) {
    return (
        <>
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
                <AttachmentUpload files={chat.pendingFiles} onFilesChange={chat.setPendingFiles} triggerRef={chat.attachTriggerRef} />
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
                        type="button"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="16" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                    </button>
                    <textarea
                        value={chat.content}
                        disabled={chat.sending}
                        maxLength={4000}
                        rows={1}
                        onChange={e => {
                            chat.setContent(e.target.value);
                            if (e.target.value) chat.sendTyping();
                            else chat.stopTyping();
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
        </>
    );
}
