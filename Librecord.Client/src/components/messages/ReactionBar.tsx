import { memo, useState } from "react";
import type { MessageReaction } from "../../types/message";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"];

interface Props {
    reactions: MessageReaction[];
    messageId: string;
    currentUserId?: string;
    onAdd?: (messageId: string, emoji: string) => void;
    onRemove: (messageId: string, emoji: string) => void;
}

export const ReactionBar = memo(function ReactionBar({ reactions, messageId, currentUserId, onAdd, onRemove }: Props) {
    const [showPicker, setShowPicker] = useState(false);

    const grouped = new Map<string, { count: number; userReacted: boolean }>();
    for (const r of reactions) {
        const existing = grouped.get(r.emoji);
        if (existing) {
            existing.count++;
            if (r.userId === currentUserId) existing.userReacted = true;
        } else {
            grouped.set(r.emoji, {
                count: 1,
                userReacted: r.userId === currentUserId,
            });
        }
    }

    function handleClick(emoji: string, userReacted: boolean) {
        if (userReacted) {
            onRemove(messageId, emoji);
        } else if (onAdd) {
            onAdd(messageId, emoji);
        }
    }

    if (grouped.size === 0) return null;

    return (
        <div className="flex items-center gap-1 mt-1 flex-wrap">
            {[...grouped.entries()].map(([emoji, { count, userReacted }]) => (
                <button
                    key={emoji}
                    onClick={() => handleClick(emoji, userReacted)}
                    className={`
                        inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs
                        ${userReacted
                            ? "bg-[#5865F2]/30 border border-[#5865F2] text-white"
                            : "bg-[#2b2d31] border border-transparent text-gray-300 hover:border-gray-500"
                        }
                    `}
                >
                    <span>{emoji}</span>
                    <span>{count}</span>
                </button>
            ))}

            {onAdd && <div className="relative">
                <button
                    onClick={() => setShowPicker(v => !v)}
                    className="px-1.5 py-0.5 rounded text-xs bg-[#2b2d31] text-gray-400 hover:text-white border border-transparent hover:border-gray-500"
                >
                    +
                </button>

                {showPicker && (
                    <div className="absolute bottom-full left-0 mb-1 bg-[#111214] rounded-lg shadow-xl p-2 flex gap-1 flex-wrap w-48 z-[100] border border-[#2b2d31] animate-[scaleIn_0.1s_ease-out]">
                        {QUICK_EMOJIS.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => {
                                    onAdd(messageId, emoji);
                                    setShowPicker(false);
                                }}
                                className="text-lg p-1 hover:bg-white/10 rounded"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>}
        </div>
    );
});
