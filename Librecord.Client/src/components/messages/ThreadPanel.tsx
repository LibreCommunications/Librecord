import { useEffect, useRef, useState } from "react";
import { useThreads, type ThreadMessage } from "../../hooks/useThreads";
import { onCustomEvent } from "../../lib/typedEvent";
import type { AppEventMap } from "../../realtime/events";
import { CloseIcon } from "../ui/Icons";

interface Props {
    channelId: string;
    threadId: string;
    threadName: string;
    onClose: () => void;
}

export function ThreadPanel({ channelId, threadId, threadName, onClose }: Props) {
    const { getThreadMessages, postThreadMessage } = useThreads();
    const [messages, setMessages] = useState<ThreadMessage[]>([]);
    const [content, setContent] = useState("");
    const [loadedThreadId, setLoadedThreadId] = useState<string | null>(null);
    const loading = loadedThreadId !== threadId;
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        getThreadMessages(channelId, threadId).then(msgs => {
            if (cancelled) return;
            setMessages(msgs.reverse());
            setLoadedThreadId(threadId);
        });
        return () => { cancelled = true; };
    }, [threadId, channelId, getThreadMessages]);

    // Listen for real-time thread messages
    useEffect(() => {
        return onCustomEvent<AppEventMap["guild:thread:message:new"]>(
            "guild:thread:message:new",
            (detail) => {
                if (detail.threadId !== threadId) return;
                setMessages(prev => {
                    if (prev.some(m => m.id === detail.messageId)) return prev;
                    return [...prev, {
                        id: detail.messageId,
                        content: detail.content,
                        createdAt: detail.createdAt,
                        editedAt: null,
                        author: detail.author,
                    }];
                });
            },
        );
    }, [threadId]);

    // Auto-scroll on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    async function handleSend() {
        if (!content.trim() || sending) return;
        setSending(true);

        await postThreadMessage(channelId, threadId, content.trim());

        setContent("");
        setSending(false);
    }

    return (
        <div className="w-96 bg-[#2b2d31] border-l border-black/20 flex flex-col">
            <div className="h-12 flex items-center justify-between px-4 border-b border-black/20">
                <span className="font-semibold text-sm text-white truncate">Thread: {threadName}</span>
                <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
                    <CloseIcon size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loading && <div className="text-sm text-gray-500">Loading...</div>}

                {messages.map(msg => (
                    <div key={msg.id} className="flex gap-2">
                        <div className="flex-1">
                            <div className="flex gap-2 text-xs">
                                <span className="font-medium text-gray-200">{msg.author.displayName}</span>
                                <span className="text-gray-500">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-sm text-gray-300 whitespace-pre-wrap mt-0.5">{msg.content}</p>
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            <div className="border-t border-black/20 p-3">
                <textarea
                    value={content}
                    disabled={sending}
                    onChange={e => setContent(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder="Reply to thread..."
                    className="w-full px-3 py-2 rounded bg-[#1e1f22] text-white text-sm resize-none outline-none"
                />
            </div>
        </div>
    );
}
