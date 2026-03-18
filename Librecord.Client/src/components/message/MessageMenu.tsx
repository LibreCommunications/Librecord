import { useState } from "react";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"];

export function MessageMenu({
                                onEdit,
                                onDelete,
                                onAddReaction,
                            }: {
    onEdit: () => void;
    onDelete: () => void;
    onAddReaction?: (emoji: string) => void;
}) {
    const [showEmojis, setShowEmojis] = useState(false);

    return (
        <div className="absolute right-8 top-8 z-50 bg-[#111214] rounded-md shadow-xl py-1.5 min-w-[160px] border border-[#2b2d31] animate-[scaleIn_0.1s_ease-out]">
            {onAddReaction && (
                <div className="relative">
                    <button
                        onClick={() => setShowEmojis(v => !v)}
                        className="w-full text-left px-3 py-1.5 text-sm text-[#b5bac1] hover:bg-[#5865F2] hover:text-white flex items-center gap-2 transition-colors"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                            <line x1="9" y1="9" x2="9.01" y2="9" />
                            <line x1="15" y1="9" x2="15.01" y2="9" />
                        </svg>
                        Add Reaction
                    </button>
                    {showEmojis && (
                        <div className="absolute right-full top-0 mr-1 bg-[#111214] rounded-lg shadow-xl p-2 flex gap-1 flex-wrap w-48 border border-[#2b2d31] animate-[scaleIn_0.1s_ease-out]">
                            {QUICK_EMOJIS.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => onAddReaction(emoji)}
                                    className="text-lg p-1 hover:bg-white/10 rounded"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
            <button
                onClick={onEdit}
                className="w-full text-left px-3 py-1.5 text-sm text-[#b5bac1] hover:bg-[#5865F2] hover:text-white flex items-center gap-2 transition-colors"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit Message
            </button>
            <button
                onClick={onDelete}
                className="w-full text-left px-3 py-1.5 text-sm text-[#f23f43] hover:bg-[#f23f43] hover:text-white flex items-center gap-2 transition-colors"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete Message
            </button>
        </div>
    );
}
