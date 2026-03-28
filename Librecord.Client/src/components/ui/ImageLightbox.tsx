import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
    src: string;
    alt?: string;
    onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: Props) {
    const [scale, setScale] = useState(1);
    const [translate, setTranslate] = useState({ x: 0, y: 0 });
    const dragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const isZoomed = scale > 1.05;

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    // Scroll wheel zoom
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setScale(prev => Math.min(Math.max(prev - e.deltaY * 0.002, 0.5), 8));
    }, []);

    // Pan via drag when zoomed
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (!isZoomed) return;
        dragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [isZoomed]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragging.current) return;
        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;
        lastPos.current = { x: e.clientX, y: e.clientY };
        setTranslate(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    }, []);

    const handlePointerUp = useCallback(() => {
        dragging.current = false;
    }, []);

    // Click image: if not zoomed, zoom to 2x. If zoomed, reset.
    const handleImageClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (isZoomed) {
            setScale(1);
            setTranslate({ x: 0, y: 0 });
        } else {
            setScale(2);
        }
    }, [isZoomed]);

    // Reset pan when unzooming
    useEffect(() => {
        if (!isZoomed) setTranslate({ x: 0, y: 0 });
    }, [isZoomed]);

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 animate-[fadeIn_0.15s_ease-out]"
            onClick={isZoomed ? undefined : onClose}
            onWheel={handleWheel}
            style={{ cursor: isZoomed ? (dragging.current ? "grabbing" : "grab") : "zoom-in", touchAction: "none" }}
        >
            <img
                src={src}
                alt={alt}
                draggable={false}
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl animate-[scaleIn_0.15s_ease-out] select-none"
                style={{
                    transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                    transition: dragging.current ? "none" : "transform 0.2s ease-out",
                    cursor: isZoomed ? "grab" : "zoom-in",
                }}
                onClick={handleImageClick}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            />

            {/* Close button */}
            <button
                onClick={onClose}
                className="fixed top-4 right-4 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>

            {/* Zoom indicator */}
            {isZoomed && (
                <div className="fixed top-4 left-4 px-2 py-1 rounded bg-black/60 text-white text-xs">
                    {Math.round(scale * 100)}%
                </div>
            )}

            {/* Open original link */}
            <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="fixed bottom-4 right-4 px-3 py-1.5 rounded bg-black/60 hover:bg-black/80 text-white text-sm flex items-center gap-1.5 transition-colors"
            >
                Open Original
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
            </a>
        </div>
    );
}
