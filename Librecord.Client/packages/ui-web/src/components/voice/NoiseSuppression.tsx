import { useCallback, useEffect, useRef, useState } from "react";
import {
    getNoiseSuppressionSettings,
    setNoiseSuppressionSettings,
    type NoiseSuppressionMode,
} from "@librecord/app";
import { getDevicePref } from "@librecord/app";
import { logger } from "@librecord/domain";

const MODES: { value: NoiseSuppressionMode; label: string; description: string }[] = [
    { value: "off", label: "Off", description: "No noise suppression" },
    { value: "threshold", label: "Threshold", description: "Noise gate" },
    { value: "automatic", label: "Automatic", description: "AI-powered" },
];

const MIN_DB = -60;
const MAX_DB = -10;

export function NoiseSuppression() {
    const [settings, setSettings] = useState(getNoiseSuppressionSettings);

    function changeMode(mode: NoiseSuppressionMode) {
        const next = { ...settings, mode };
        setSettings(next);
        setNoiseSuppressionSettings(next);
    }

    function changeThreshold(db: number) {
        const clamped = Math.max(MIN_DB, Math.min(MAX_DB, Math.round(db)));
        const next = { ...settings, thresholdDb: clamped };
        setSettings(next);
        setNoiseSuppressionSettings(next);
    }

    return (
        <div className="bg-[#2b2d31] rounded-lg px-4 py-3">
            <label className="text-sm font-medium text-white block mb-3">
                Noise Suppression
            </label>

            {/* Mode selector */}
            <div className="grid grid-cols-3 gap-2 mb-3">
                {MODES.map(({ value, label, description }) => (
                    <button
                        key={value}
                        onClick={() => changeMode(value)}
                        className={`
                            flex flex-col items-center gap-0.5 p-2.5 rounded-lg border-2 transition-colors
                            ${settings.mode === value
                                ? "border-[#5865F2] bg-[#5865F2]/10"
                                : "border-[#3f4147] bg-[#1e1f22] hover:border-[#4e5058]"
                            }
                        `}
                    >
                        <span className={`text-sm font-semibold ${settings.mode === value ? "text-white" : "text-[#b5bac1]"}`}>
                            {label}
                        </span>
                        <span className="text-[10px] text-[#949ba4]">{description}</span>
                    </button>
                ))}
            </div>

            {/* Threshold slider with live meter */}
            {settings.mode === "threshold" && (
                <ThresholdSlider
                    thresholdDb={settings.thresholdDb}
                    onChange={changeThreshold}
                />
            )}

            {/* Automatic info */}
            {settings.mode === "automatic" && (
                <p className="text-xs text-[#949ba4] mt-1">
                    AI-powered noise suppression removes background noise while preserving your voice.
                    Uses RNNoise for real-time processing.
                </p>
            )}
        </div>
    );
}

// ── Threshold slider with live mic meter ─────────────────────

function ThresholdSlider({
    thresholdDb,
    onChange,
}: {
    thresholdDb: number;
    onChange: (db: number) => void;
}) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);
    const [micLevel, setMicLevel] = useState(-100); // current mic dB

    // Live mic level monitoring
    const streamRef = useRef<MediaStream | null>(null);
    const ctxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function startMicPreview() {
            try {
                const micId = getDevicePref("audioinput");
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        ...(micId && { deviceId: micId }),
                        noiseSuppression: false,
                        echoCancellation: false,
                        autoGainControl: false,
                    },
                });
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

                streamRef.current = stream;
                const ctx = new AudioContext();
                ctxRef.current = ctx;
                const source = ctx.createMediaStreamSource(stream);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);
                analyserRef.current = analyser;

                const buf = new Float32Array(analyser.fftSize);
                function poll() {
                    if (cancelled) return;
                    analyser.getFloatTimeDomainData(buf);
                    let sum = 0;
                    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
                    const rms = Math.sqrt(sum / buf.length);
                    const dB = rms > 0 ? 20 * Math.log10(rms) : -100;
                    setMicLevel(dB);
                    rafRef.current = requestAnimationFrame(poll);
                }
                poll();
            } catch (err) {
                logger.voice.warn("Could not access mic for preview", err);
            }
        }

        startMicPreview();

        return () => {
            cancelled = true;
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
            streamRef.current?.getTracks().forEach(t => t.stop());
            ctxRef.current?.close().catch(e => logger.voice.warn("Failed to close AudioContext", e));
            streamRef.current = null;
            ctxRef.current = null;
            analyserRef.current = null;
        };
    }, []);

    // Resolve dB from mouse position
    const resolveFromEvent = useCallback((clientX: number) => {
        const track = trackRef.current;
        if (!track) return;
        const rect = track.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        onChange(MIN_DB + ratio * (MAX_DB - MIN_DB));
    }, [onChange]);

    // Drag handling
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

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 2;
        onChange(thresholdDb + (e.deltaY < 0 ? step : -step));
    }, [thresholdDb, onChange]);

    // Percentages for positioning
    const thresholdPct = ((thresholdDb - MIN_DB) / (MAX_DB - MIN_DB)) * 100;
    const micLevelClamped = Math.max(MIN_DB, Math.min(MAX_DB, micLevel));
    const micPct = ((micLevelClamped - MIN_DB) / (MAX_DB - MIN_DB)) * 100;
    const isAboveThreshold = micLevel >= thresholdDb;

    return (
        <div className="mt-2">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-[#b5bac1]">Threshold</span>
                <span className="text-xs text-[#dbdee1] font-mono tabular-nums w-[42px] text-right">
                    {thresholdDb} dB
                </span>
            </div>

            <div
                ref={trackRef}
                className="h-6 flex items-center cursor-pointer group/slider"
                onMouseDown={e => { setDragging(true); resolveFromEvent(e.clientX); }}
                onWheel={handleWheel}
            >
                <div className="w-full h-[8px] rounded-full bg-[#1e1f22] relative overflow-hidden">
                    {/* Live mic level bar */}
                    <div
                        className={`absolute inset-y-0 left-0 transition-[width] duration-75 rounded-full ${
                            isAboveThreshold ? "bg-emerald-500/60" : "bg-red-500/40"
                        }`}
                        style={{ width: `${Math.max(0, micPct)}%` }}
                    />
                    {/* Threshold position indicator (vertical line) */}
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-10"
                        style={{ left: `${thresholdPct}%` }}
                    />
                    {/* Thumb */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md z-20 opacity-0 group-hover/slider:opacity-100 transition-opacity"
                        style={{ left: `calc(${thresholdPct}% - 7px)` }}
                    />
                </div>
            </div>

            <div className="flex justify-between mt-1">
                <span className="text-[10px] text-[#72767d]">{MIN_DB} dB</span>
                <span className="text-[10px] text-[#72767d]">{MAX_DB} dB</span>
            </div>
        </div>
    );
}
