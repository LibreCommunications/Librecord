import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EmojiIcon, PinIcon, ThreadIcon } from "../../components/ui/Icons";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"];

export function MessageMenu({
                                anchorRef,
                                onAddReaction,
                                onPin,
                                onStartThread,
                                onClose,
                                isPinned = false,
                            }: {
    anchorRef: React.RefObject<HTMLElement | null>;
    onAddReaction?: (emoji: string) => void;
    onPin?: () => void;
    onStartThread?: () => void;
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
                            <EmojiIcon size={18} />
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
                        <PinIcon size={18} />
                        {isPinned ? "Unpin Message" : "Pin Message"}
                    </button>
                )}
                {onStartThread && (
                    <button
                        role="menuitem"
                        onClick={onStartThread}
                        data-testid="start-thread-btn"
                        className="w-full text-left px-3 py-2 text-sm text-[#dbdee1] hover:bg-[#4752c4] hover:text-white flex items-center gap-2.5 rounded-[3px] mx-1 transition-colors"
                    >
                        <ThreadIcon size={18} />
                        Start Thread
                    </button>
                )}
            </div>
        </>,
        document.body
    );
}
