import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"];

export function MessageMenu({
                                anchorRef,
                                onAddReaction,
                                onPin,
                                onClose,
                                isPinned = false,
                            }: {
    anchorRef: React.RefObject<HTMLElement | null>;
    onAddReaction?: (emoji: string) => void;
    onPin?: () => void;
    onClose: () => void;
    isPinned?: boolean;
}) {
    const [showEmojis, setShowEmojis] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const updatePosition = useCallback(() => {
        const anchor = anchorRef.current;
        if (!anchor) return;
        const anchorRect = anchor.getBoundingClientRect();

        const left = anchorRect.right - 170;
        let top = anchorRect.bottom + 4;

        const el = menuRef.current;
        if (el) {
            const menuHeight = el.offsetHeight;
            if (top + menuHeight > window.innerHeight) {
                top = anchorRect.top - menuHeight - 4;
            }
        }

        setPos({ top, left });
    }, [anchorRef]);

    useLayoutEffect(() => {
        updatePosition();
    }, [updatePosition]);

    useEffect(() => {
        window.addEventListener("resize", updatePosition);
        // Also track scroll on the message list ancestor
        const scrollParent = anchorRef.current?.closest(".overflow-y-auto");
        scrollParent?.addEventListener("scroll", updatePosition);
        return () => {
            window.removeEventListener("resize", updatePosition);
            scrollParent?.removeEventListener("scroll", updatePosition);
        };
    }, [updatePosition, anchorRef]);

    return createPortal(
        <>
            <div className="fixed inset-0 z-[9998]" onClick={onClose} />
            <div
                ref={menuRef}
                style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden", top: 0, left: 0 }}
                role="menu"
                data-testid="message-menu"
                className="fixed z-[9999] bg-[#111214] rounded-lg shadow-xl py-1 min-w-[170px] border border-[#2b2d31]"
            >
                {onAddReaction && (
                    <div className="relative">
                        <button
                            role="menuitem"
                            onClick={() => setShowEmojis(v => !v)}
                            className="w-full text-left px-3 py-2 text-sm text-[#dbdee1] hover:bg-[#4752c4] hover:text-white flex items-center gap-2.5 rounded-[3px] mx-1 transition-colors"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                                <line x1="9" y1="9" x2="9.01" y2="9" />
                                <line x1="15" y1="9" x2="15.01" y2="9" />
                            </svg>
                            Add Reaction
                        </button>
                        {showEmojis && (
                            <div className="absolute right-full top-0 mr-1.5 bg-[#111214] rounded-lg shadow-xl p-2 flex gap-1 flex-wrap w-52 border border-[#2b2d31] animate-[scaleIn_0.1s_ease-out]">
                                {QUICK_EMOJIS.map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => onAddReaction(emoji)}
                                        aria-label={`React with ${emoji}`}
                                        data-testid={`reaction-${emoji}`}
                                        className="text-xl p-1.5 hover:bg-white/10 rounded-md transition-colors"
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
                        role="menuitem"
                        onClick={onPin}
                        data-testid="pin-message-btn"
                        className="w-full text-left px-3 py-2 text-sm text-[#dbdee1] hover:bg-[#4752c4] hover:text-white flex items-center gap-2.5 rounded-[3px] mx-1 transition-colors"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="17" x2="12" y2="22" />
                            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                        </svg>
                        {isPinned ? "Unpin Message" : "Pin Message"}
                    </button>
                )}
            </div>
        </>,
        document.body
    );
}
