import { memo, useRef, useState } from "react";
import { MessageMenu } from "./MessageMenu";
import { ReactionBar } from "../messages/ReactionBar";
import { ImageLightbox } from "../ui/ImageLightbox";
import { UserHoverCard } from "../user/UserHoverCard";
import { renderMarkdown } from "../../utils/markdown";
import type { MessageItemProps } from "./MessageItemProps";
import { API_URL } from "../../api/client";
import { EditIcon, TrashIcon, ReplyIcon, MoreIcon, FileIcon } from "../../components/ui/Icons";

function resolveAttachmentUrl(url: string): string {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_URL}${url}`;
}

function formatTimestamp(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (isToday) return `Today at ${time}`;
    if (isYesterday) return `Yesterday at ${time}`;
    return `${date.toLocaleDateString()} ${time}`;
}

export const MessageItem = memo(function MessageItem({
                                msg,
                                isAuthor,
                                isEditing,
                                menuOpen,
                                currentUserId,
                                isPinned,
                                canManageMessages,
                                onToggleMenu,
                                onStartEdit,
                                onReply,
                                onScrollToReply,
                                onCancelEdit,
                                onDelete,
                                onPin,
                                onAddReaction,
                                onRemoveReaction,
                                editMessage,
                                getAvatarUrl,
                            }: MessageItemProps) {
    const [editContent, setEditContent] = useState(msg.content);
    const [lightboxSrc, setLightboxSrc] = useState<{ src: string; alt: string } | null>(null);
    const moreButtonRef = useRef<HTMLButtonElement>(null);

    return (
        <div className="flex flex-col px-4 py-1.5 group relative hover:bg-[#2e3035] transition-colors" data-testid={`message-${msg.id}`}>
            {msg.replyTo && (
                <button
                    type="button"
                    onClick={() => onScrollToReply?.(msg.replyTo!.messageId)}
                    className="flex items-center gap-1.5 pl-[30px] mb-0.5 text-xs text-[#949ba4] hover:text-[#dbdee1] cursor-pointer"
                >
                    <span className="w-8 h-[13px] border-l-2 border-t-2 border-[#4e5058] rounded-tl-md shrink-0" />
                    <img
                        src={getAvatarUrl(msg.replyTo.author?.avatarUrl)}
                        className="w-4 h-4 rounded-full object-cover shrink-0"
                        alt=""
                    />
                    <span className="font-semibold text-[#c4c9ce]">
                        {msg.replyTo.author?.displayName ?? "Unknown"}
                    </span>
                    {msg.replyTo.content?.trim()
                        ? <span className="truncate max-w-[400px]">{msg.replyTo.content.split("\n")[0]}</span>
                        : <span className="italic text-[#949ba4]">📷 Click to see attachment</span>
                    }
                </button>
            )}
            <div className="flex gap-4">
            <img
                src={getAvatarUrl(msg.author.avatarUrl)}
                loading="lazy"
                onClick={() => window.dispatchEvent(new CustomEvent("user:profile:open", { detail: { userId: msg.author.id } }))}
                className="w-10 h-10 rounded-full object-cover mt-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                alt=""
            />

            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    <UserHoverCard userId={msg.author.id}>
                        <span
                            className="font-medium text-[#f2f3f5] hover:underline cursor-pointer"
                            onClick={() => window.dispatchEvent(new CustomEvent("user:profile:open", { detail: { userId: msg.author.id } }))}
                        >
                            {msg.author.displayName}
                        </span>
                    </UserHoverCard>
                    <span className="text-xs text-[#949ba4]">
                        {formatTimestamp(msg.createdAt)}
                    </span>
                    {msg.editedAt && (
                        <span
                            className="text-[10px] text-[#949ba4] cursor-default"
                            title={`Edited ${formatTimestamp(msg.editedAt)}`}
                        >
                            (edited)
                        </span>
                    )}
                </div>

                {isEditing ? (
                    <div className="mt-1">
                        <textarea
                            value={editContent}
                            autoFocus
                            aria-label="Edit message"
                            onChange={e => setEditContent(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    editMessage(msg.id, { content: editContent });
                                    onCancelEdit();
                                }
                                if (e.key === "Escape") {
                                    setEditContent(msg.content);
                                    onCancelEdit();
                                }
                            }}
                            className="w-full bg-[#383a40] rounded-lg px-3 py-2 text-[#dbdee1] outline-none border border-[#5865F2] resize-none"
                        data-testid="edit-message-input"
                            rows={Math.min(editContent.split("\n").length, 6)}
                        />
                        <div className="text-xs text-[#949ba4] mt-1">
                            escape to{" "}
                            <button onClick={() => { setEditContent(msg.content); onCancelEdit(); }} className="text-[#00a8fc] hover:underline">cancel</button>
                            {" "}&bull; enter to{" "}
                            <button onClick={() => { editMessage(msg.id, { content: editContent }); onCancelEdit(); }} className="text-[#00a8fc] hover:underline">save</button>
                        </div>
                    </div>
                ) : (
                    <div
                        className="leading-relaxed text-[#dbdee1] message-content [&_a]:text-[#00a8fc] [&_a:hover]:underline [&_code]:bg-[#2b2d31] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm"
                        data-testid="message-content"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                )}

                {/* Attachments */}
                {msg.attachments.length > 0 && (
                    <div className="mt-2 flex flex-col gap-2">
                        {msg.attachments.map(att => {
                            const src = resolveAttachmentUrl(att.url);

                            if (att.contentType.startsWith("image/")) {
                                // Constrain to max 448px wide, 320px tall, preserving aspect ratio
                                const maxW = 448, maxH = 320;
                                let style: React.CSSProperties | undefined;
                                if (att.width && att.height) {
                                    const scale = Math.min(maxW / att.width, maxH / att.height, 1);
                                    style = { width: att.width * scale, height: att.height * scale };
                                } else {
                                    style = { maxWidth: maxW, height: maxH };
                                }
                                return (
                                    <img
                                        key={att.id}
                                        src={src}
                                        alt={att.fileName}
                                        onClick={() => setLightboxSrc({ src, alt: att.fileName })}
                                        style={style}
                                        className="rounded-lg object-cover cursor-zoom-in hover:brightness-110 transition"
                                    />
                                );
                            }

                            if (att.contentType.startsWith("video/")) {
                                return (
                                    <video
                                        key={att.id}
                                        src={src}
                                        controls
                                        preload="metadata"
                                        className="max-w-md rounded-lg"
                                        style={{ maxHeight: 320 }}
                                    />
                                );
                            }

                            if (att.contentType.startsWith("audio/")) {
                                return (
                                    <div key={att.id} className="flex items-center gap-2 bg-[#2b2d31] rounded-lg p-3 max-w-md border border-[#1e1f22]">
                                        <audio src={src} controls preload="none" className="flex-1" />
                                        <span className="text-xs text-[#949ba4] shrink-0">{att.fileName}</span>
                                    </div>
                                );
                            }

                            return (
                                <a
                                    key={att.id}
                                    href={src}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 bg-[#2b2d31] border border-[#1e1f22] rounded-lg px-4 py-3 hover:bg-[#35373c] max-w-md transition-colors"
                                >
                                    <FileIcon size={24} className="text-[#949ba4] shrink-0" />
                                    <div className="min-w-0">
                                        <div className="text-sm text-[#00a8fc] truncate hover:underline">{att.fileName}</div>
                                        <div className="text-xs text-[#949ba4]">{(att.size / 1024).toFixed(1)} KB</div>
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                )}

                {/* Reactions */}
                <ReactionBar
                    reactions={msg.reactions}
                    messageId={msg.id}
                    currentUserId={currentUserId}
                    onAdd={onAddReaction}
                    onRemove={onRemoveReaction}
                />
            </div>

            </div>{/* end flex gap-4 */}

            {/* Action buttons - visible on hover */}
            <div className={`absolute -top-3 right-4 transition-opacity ${menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                <div className="relative">
                    <div className="flex bg-[#111214] rounded border border-[#2b2d31] shadow-lg">
                        {isAuthor && (
                            <button
                                onClick={() => onStartEdit(msg.id)}
                                className="px-2 py-1 text-[#b5bac1] hover:text-white hover:bg-[#35373c] transition-colors rounded-l"
                                title="Edit"
                                aria-label="Edit message"
                                data-testid="edit-message-btn"
                            >
                                <EditIcon size={16} />
                            </button>
                        )}
                        {(isAuthor || canManageMessages) && (
                            <button
                                onClick={() => onDelete(msg.id)}
                                className="px-2 py-1 text-[#b5bac1] hover:text-[#f23f43] hover:bg-[#35373c] transition-colors"
                                title="Delete"
                                aria-label="Delete message"
                                data-testid="delete-message-btn"
                            >
                                <TrashIcon size={16} />
                            </button>
                        )}
                        <button
                            onClick={() => onReply(msg.id)}
                            className="px-2 py-1 text-[#b5bac1] hover:text-white hover:bg-[#35373c] transition-colors"
                            title="Reply"
                            aria-label="Reply to message"
                            data-testid="reply-message-btn"
                        >
                            <ReplyIcon size={16} />
                        </button>
                        <button
                            ref={moreButtonRef}
                            onClick={() => onToggleMenu(msg.id)}
                            className="px-2 py-1 text-[#b5bac1] hover:text-white hover:bg-[#35373c] transition-colors rounded-r"
                            title="More"
                            aria-label="More actions"
                            data-testid="more-actions-btn"
                        >
                            <MoreIcon size={16} />
                        </button>
                    </div>
                    {menuOpen && (
                        <MessageMenu
                            anchorRef={moreButtonRef}
                            onAddReaction={(emoji) => {
                                onAddReaction(msg.id, emoji);
                                onToggleMenu(msg.id);
                            }}
                            onPin={onPin ? () => { onPin(msg.id); onToggleMenu(msg.id); } : undefined}
                            onClose={() => onToggleMenu(msg.id)}
                            isPinned={isPinned}
                        />
                    )}
                </div>
            </div>

            {lightboxSrc && (
                <ImageLightbox
                    src={lightboxSrc.src}
                    alt={lightboxSrc.alt}
                    onClose={() => setLightboxSrc(null)}
                />
            )}
        </div>
    );
});
