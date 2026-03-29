import { useEffect, useRef, useState } from "react";

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
    // Dispatch event so audio elements can update
    window.dispatchEvent(new CustomEvent("voice:volume:changed", { detail: { userId, volume } }));
}

// Quadratic curve: slider position (0-200) → actual gain
// Makes the slider feel natural — small changes near quiet are more precise,
// and boosting above 100% requires more slider movement.
function sliderToGain(slider: number): number {
    return Math.round((slider / 100) * (slider / 100) * 100);
}

// Inverse: actual gain (stored %) → slider position
function gainToSlider(gain: number): number {
    return Math.round(Math.sqrt(gain / 100) * 100);
}

interface Props {
    userId: string;
    displayName: string;
    x: number;
    y: number;
    onClose: () => void;
}

export function VolumePopup({ userId, displayName, x, y, onClose }: Props) {
    const [volume, setVolume] = useState(() => getUserVolume(userId));
    const slider = gainToSlider(volume);
    const popupRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: y, left: x });

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

    function handleSliderChange(sliderVal: number) {
        const gain = sliderToGain(sliderVal);
        setVolume(gain);
        setUserVolume(userId, gain);
    }

    function handleReset() {
        setVolume(100);
        setUserVolume(userId, 100);
    }

    return (
        <div
            ref={popupRef}
            className="fixed z-[999] bg-[#111214] rounded-lg shadow-xl border border-[#2b2d31] p-3 w-[280px]"
            style={{ top: pos.top, left: pos.left }}
        >
            <div className="text-xs font-semibold text-[#b5bac1] mb-2 truncate">{displayName}</div>
            <div className="flex items-center gap-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#949ba4] shrink-0">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                </svg>
                <input
                    type="range"
                    min={0}
                    max={200}
                    value={slider}
                    onChange={e => handleSliderChange(Number(e.target.value))}
                    className="flex-1 accent-[#5865F2] h-1.5"
                />
                <span className="text-xs text-[#dbdee1] w-10 text-right font-mono">{volume}%</span>
            </div>
            {volume !== 100 && (
                <button
                    onClick={handleReset}
                    className="text-[10px] text-[#5865F2] hover:underline mt-1"
                >
                    Reset to 100%
                </button>
            )}
        </div>
    );
}
