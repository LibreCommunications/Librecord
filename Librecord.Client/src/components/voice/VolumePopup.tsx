import { useEffect, useRef, useState, useCallback } from "react";

const VOLUMES_KEY = "librecord:userVolumes";

export function getUserVolume(userId: string): number {
    try {
        const vols = JSON.parse(localStorage.getItem(VOLUMES_KEY) ?? "{}");
        return vols[userId] ?? 100;
    } catch { return 100; }
}

export function setUserVolume(userId: string, volume: number) {
    try {
        const vols = JSON.parse(localStorage.getItem(VOLUMES_KEY) ?? "{}");
        vols[userId] = volume;
        localStorage.setItem(VOLUMES_KEY, JSON.stringify(vols));
    } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent("voice:volume:changed", { detail: { userId, volume } }));
}

interface Props {
    userId: string;
    displayName: string;
    x: number;
    y: number;
    onClose: () => void;
}

function VolumeIcon({ volume }: { volume: number }) {
    if (volume === 0) {
        return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
        );
    }
    if (volume <= 50) {
        return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
        );
    }
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
    );
}

export function VolumePopup({ userId, displayName, x, y, onClose }: Props) {
    const [volume, setVolume] = useState(() => getUserVolume(userId));
    const popupRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: y, left: x });
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        const el = popupRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const top = Math.min(y, window.innerHeight - rect.height - 8);
        const left = Math.min(x, window.innerWidth - rect.width - 8);
        setPos({ top: Math.max(8, top), left: Math.max(8, left) });
    }, [x, y]);

    useEffect(() => {
        function onClick(e: MouseEvent) {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
        }
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, [onClose]);

    const commit = useCallback((val: number) => {
        const clamped = Math.max(0, Math.min(200, Math.round(val)));
        setVolume(clamped);
        setUserVolume(userId, clamped);
    }, [userId]);

    // Resolve slider value from mouse/touch position on the track
    const resolveFromEvent = useCallback((clientX: number) => {
        const track = trackRef.current;
        if (!track) return;
        const rect = track.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        commit(Math.round(ratio * 200));
    }, [commit]);

    // Mouse drag handling
    useEffect(() => {
        if (!dragging) return;
        function onMove(e: MouseEvent) { resolveFromEvent(e.clientX); }
        function onUp() { setDragging(false); }
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [dragging, resolveFromEvent]);

    // Scroll wheel on the track for fine adjustment
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 5;
        commit(volume + (e.deltaY < 0 ? step : -step));
    }, [volume, commit]);

    const pct = (volume / 200) * 100;

    return (
        <div
            ref={popupRef}
            className="fixed z-[999] bg-[#111214] rounded-lg shadow-xl border border-[#2b2d31] py-2.5 px-3 w-[280px] select-none"
            style={{ top: pos.top, left: pos.left }}
        >
            <div className="text-[11px] font-semibold text-[#b5bac1] mb-2 truncate uppercase tracking-wide">
                {displayName}
            </div>

            <div className="flex items-center gap-2.5">
                <button
                    onClick={() => commit(volume === 0 ? 100 : 0)}
                    className="text-[#949ba4] hover:text-[#dbdee1] transition-colors shrink-0"
                    title={volume === 0 ? "Unmute" : "Mute"}
                >
                    <VolumeIcon volume={volume} />
                </button>

                {/* Custom slider track */}
                <div
                    ref={trackRef}
                    className="flex-1 h-5 flex items-center cursor-pointer group/slider"
                    onMouseDown={e => { setDragging(true); resolveFromEvent(e.clientX); }}
                    onWheel={handleWheel}
                >
                    <div className="w-full h-[6px] rounded-full bg-[#4e5058] relative">
                        <div
                            className="absolute inset-y-0 left-0 rounded-full bg-[#5865f2] transition-[width] duration-[30ms]"
                            style={{ width: `${pct}%` }}
                        />
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md transition-[left] duration-[30ms] opacity-0 group-hover/slider:opacity-100"
                            style={{ left: `calc(${pct}% - 6px)` }}
                        />
                    </div>
                </div>

                <span className="text-xs text-[#dbdee1] w-[38px] text-right font-mono tabular-nums">
                    {volume}%
                </span>
            </div>

            {volume !== 100 && (
                <button
                    onClick={() => commit(100)}
                    className="text-[10px] text-[#5865F2] hover:underline mt-1.5"
                >
                    Reset to 100%
                </button>
            )}
        </div>
    );
}
