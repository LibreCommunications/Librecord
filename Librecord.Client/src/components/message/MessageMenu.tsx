import { useState } from "react";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"];

export function MessageMenu({
                                onAddReaction,
                                onPin,
                                isPinned = false,
                            }: {
    onAddReaction?: (emoji: string) => void;
    onPin?: () => void;
    isPinned?: boolean;
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
            {onPin && (
                <button
                    onClick={onPin}
                    className="w-full text-left px-3 py-1.5 text-sm text-[#b5bac1] hover:bg-[#5865F2] hover:text-white flex items-center gap-2 transition-colors"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="17" x2="12" y2="22" />
                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                    </svg>
                    {isPinned ? "Unpin Message" : "Pin Message"}
                </button>
            )}
        </div>
    );
}
