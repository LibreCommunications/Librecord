import { useEffect, useState } from "react";

interface Props {
    src: string;
    alt?: string;
    onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: Props) {
    const [zoomed, setZoomed] = useState(false);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 animate-[fadeIn_0.15s_ease-out] overflow-auto"
            onClick={zoomed ? () => setZoomed(false) : onClose}
            style={{ cursor: zoomed ? "zoom-out" : "default" }}
        >
            <img
                src={src}
                alt={alt}
                className={`rounded-lg shadow-2xl animate-[scaleIn_0.15s_ease-out] transition-transform duration-200 ${
                    zoomed
                        ? "max-w-none max-h-none cursor-zoom-out"
                        : "max-w-[90vw] max-h-[90vh] object-contain cursor-zoom-in"
                }`}
                onClick={e => {
                    e.stopPropagation();
                    setZoomed(!zoomed);
                }}
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
