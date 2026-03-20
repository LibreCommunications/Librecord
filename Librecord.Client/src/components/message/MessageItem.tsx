import { useState } from "react";
import { MessageMenu } from "./MessageMenu";
import { ReactionBar } from "../messages/ReactionBar";
import { ImageLightbox } from "../ui/ImageLightbox";
import { renderMarkdown } from "../../utils/markdown";
import type { MessageItemProps } from "./MessageItemProps";

const API_URL = import.meta.env.VITE_API_URL;

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

export function MessageItem({
                                msg,
                                isAuthor,
                                isEditing,
                                menuOpen,
                                currentUserId,
                                isPinned,
                                onToggleMenu,
                                onStartEdit,
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

    return (
        <div className="flex gap-4 px-4 py-1.5 group relative hover:bg-[#2e3035] transition-colors">
            <img
                src={getAvatarUrl(msg.author.avatarUrl)}
                className="w-10 h-10 rounded-full object-cover mt-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                alt=""
            />

            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    <span className="font-medium text-[#f2f3f5] hover:underline cursor-pointer">
                        {msg.author.displayName}
                    </span>
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
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                )}

                {/* Attachments */}
                {msg.attachments.length > 0 && (
                    <div className="mt-2 flex flex-col gap-2">
                        {msg.attachments.map(att => {
                            const src = resolveAttachmentUrl(att.url);

                            if (att.contentType.startsWith("image/")) {
                                return (
                                    <img
                                        key={att.id}
                                        src={src}
                                        alt={att.fileName}
                                        onClick={() => setLightboxSrc({ src, alt: att.fileName })}
                                        className="max-w-md max-h-80 rounded-lg object-contain border border-[#1e1f22] cursor-zoom-in hover:brightness-110 transition"
                                    />
                                );
                            }

                            if (att.contentType.startsWith("video/")) {
                                return (
                                    <video
                                        key={att.id}
                                        src={src}
                                        controls
                                        className="max-w-md max-h-80 rounded-lg"
                                    />
                                );
                            }

                            if (att.contentType.startsWith("audio/")) {
                                return (
                                    <div key={att.id} className="flex items-center gap-2 bg-[#2b2d31] rounded-lg p-3 max-w-md border border-[#1e1f22]">
                                        <audio src={src} controls className="flex-1" />
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
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#949ba4] shrink-0">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
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

            {/* Action buttons - visible on hover */}
            <div className={`absolute -top-3 right-4 transition-opacity ${menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                <div className="relative">
                    <div className="flex bg-[#111214] rounded border border-[#2b2d31] shadow-lg">
                        {isAuthor && (
                            <button
                                onClick={onStartEdit}
                                className="px-2 py-1 text-[#b5bac1] hover:text-white hover:bg-[#35373c] transition-colors rounded-l"
                                title="Edit"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                            </button>
                        )}
                        {isAuthor && (
                            <button
                                onClick={onDelete}
                                className="px-2 py-1 text-[#b5bac1] hover:text-[#f23f43] hover:bg-[#35373c] transition-colors"
                                title="Delete"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                            </button>
                        )}
                        <button
                            onClick={onToggleMenu}
                            className={`px-2 py-1 text-[#b5bac1] hover:text-white hover:bg-[#35373c] transition-colors ${isAuthor ? "" : "rounded-l"} rounded-r`}
                            title="More"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="12" cy="19" r="2" />
                            </svg>
                        </button>
                    </div>
                    {menuOpen && (
                        <MessageMenu
                            onAddReaction={(emoji) => {
                                onAddReaction(msg.id, emoji);
                                onToggleMenu();
                            }}
                            onPin={onPin ? () => { onPin(); onToggleMenu(); } : undefined}
                            onClose={onToggleMenu}
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
}
