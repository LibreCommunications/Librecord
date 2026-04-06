import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getPipecapAPI, type AudioAppInfo } from "@librecord/domain";

interface Props {
    anchorRef: React.RefObject<HTMLButtonElement | null>;
    onClose: () => void;
}

export function AudioSourcePicker({ anchorRef, onClose }: Props) {
    const [apps, setApps] = useState<AudioAppInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const pipecap = getPipecapAPI();
        if (!pipecap) { onClose(); return; }
        pipecap.listAudioApps().then(result => {
            setApps(result);
            setLoading(false);
        });
    }, [onClose]);

    useEffect(() => {
        function onClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node) &&
                anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
                onClose();
            }
        }
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, [onClose, anchorRef]);

    // Position above the anchor button
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const style: React.CSSProperties = {
        position: "fixed",
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        zIndex: 9999,
    };

    function select(target: string) {
        const pipecap = getPipecapAPI();
        if (pipecap) pipecap.setAudioTarget(target);
        onClose();
    }

    return createPortal(
        <div
            ref={ref}
            style={style}
            className="bg-[#111214] border border-[#2b2d31] rounded-lg shadow-xl py-1 min-w-[220px] max-h-[300px] overflow-y-auto"
        >
            <div className="px-3 py-1.5 text-xs font-semibold text-[#949ba4] uppercase tracking-wide">
                Audio Source
            </div>

            <button
                onClick={() => select("system")}
                className="w-full text-left px-3 py-2 text-sm text-[#dbdee1] hover:bg-white/10 flex items-center gap-2"
            >
                <span className="text-[#949ba4]"><SpeakerIcon /></span>
                System Audio
            </button>

            <button
                onClick={() => select("none")}
                className="w-full text-left px-3 py-2 text-sm text-[#dbdee1] hover:bg-white/10 flex items-center gap-2"
            >
                <span className="text-[#949ba4]"><MuteIcon /></span>
                No Audio
            </button>

            {apps.length > 0 && (
                <div className="border-t border-[#2b2d31] mt-1 pt-1">
                    <div className="px-3 py-1 text-xs font-semibold text-[#949ba4] uppercase tracking-wide">
                        Applications
                    </div>
                    {apps.map(app => (
                        <button
                            key={app.name}
                            onClick={() => select(app.name)}
                            className="w-full text-left px-3 py-2 text-sm text-[#dbdee1] hover:bg-white/10 truncate"
                            title={`${app.name} (${app.binary})`}
                        >
                            {app.name}
                        </button>
                    ))}
                </div>
            )}

            {loading && (
                <div className="px-3 py-2 text-xs text-[#949ba4]">Loading...</div>
            )}
        </div>,
        document.body,
    );
}

function SpeakerIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11 5L6 9H2v6h4l5 4V5zm8.07.93a10 10 0 010 12.14l-1.41-1.41a8 8 0 000-9.32l1.41-1.41zM15.54 8.46a5 5 0 010 7.07l-1.41-1.41a3 3 0 000-4.24l1.41-1.42z" />
        </svg>
    );
}

function MuteIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11 5L6 9H2v6h4l5 4V5zm5.54 3.46L15.12 9.88l1.42 1.41L18 9.88l1.41 1.41 1.42-1.41L19.41 8.46 20.83 7.05l-1.42-1.42L18 7.05l-1.41-1.42-1.42 1.42 1.41 1.41z" />
        </svg>
    );
}
