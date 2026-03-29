import type { Track } from "livekit-client";
import type { TrackProcessor, AudioProcessorOptions } from "livekit-client";

export type NoiseSuppressionMode = "off" | "threshold" | "automatic";

export interface NoiseSuppressionSettings {
    mode: NoiseSuppressionMode;
    thresholdDb: number; // -60 to -10
}

const STORAGE_KEY = "librecord:noiseSuppression";
const EVENT_NAME = "voice:noisesuppression:changed";

const DEFAULTS: NoiseSuppressionSettings = { mode: "off", thresholdDb: -35 };

export function getNoiseSuppressionSettings(): NoiseSuppressionSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULTS };
}

export function setNoiseSuppressionSettings(patch: Partial<NoiseSuppressionSettings>) {
    const current = getNoiseSuppressionSettings();
    const next = { ...current, ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
}

// ── Processor lifecycle ──────────────────────────────────────

type AudioTrackProcessor = TrackProcessor<Track.Kind.Audio, AudioProcessorOptions>;

let activeProcessor: AudioTrackProcessor | null = null;

export async function applyNoiseSuppressionToTrack(
    track: { setProcessor: (p: AudioTrackProcessor) => Promise<void>; stopProcessor: () => Promise<void> },
) {
    const settings = getNoiseSuppressionSettings();

    // Tear down existing processor
    if (activeProcessor) {
        try { await track.stopProcessor(); } catch { /* may already be stopped */ }
        activeProcessor = null;
    }

    if (settings.mode === "off") return;

    if (settings.mode === "threshold") {
        const { createNoiseGateProcessor } = await import("./noiseGateProcessor");
        activeProcessor = createNoiseGateProcessor(settings.thresholdDb);
        await track.setProcessor(activeProcessor);
    } else if (settings.mode === "automatic") {
        const { createRNNoiseProcessor } = await import("./rnnoiseProcessor");
        activeProcessor = createRNNoiseProcessor();
        await track.setProcessor(activeProcessor);
    }
}

export function getActiveProcessor(): AudioTrackProcessor | null {
    return activeProcessor;
}

export function clearActiveProcessor() {
    activeProcessor = null;
}
