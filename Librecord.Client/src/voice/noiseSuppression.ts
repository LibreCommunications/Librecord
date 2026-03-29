import { logger } from "../lib/logger";
import type { Track } from "livekit-client";
import type { TrackProcessor, AudioProcessorOptions } from "livekit-client";
import type { RNNoiseHandle } from "./rnnoiseProcessor";
import { STORAGE } from "../lib/storageKeys";

export type NoiseSuppressionMode = "off" | "threshold" | "automatic";

export interface NoiseSuppressionSettings {
    mode: NoiseSuppressionMode;
    thresholdDb: number; // -60 to -10
}

const EVENT_NAME = "voice:noisesuppression:changed";

const DEFAULTS: NoiseSuppressionSettings = { mode: "off", thresholdDb: -35 };

export function getNoiseSuppressionSettings(): NoiseSuppressionSettings {
    try {
        const raw = localStorage.getItem(STORAGE.noiseSuppression);
        if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULTS };
}

export function setNoiseSuppressionSettings(patch: Partial<NoiseSuppressionSettings>) {
    const current = getNoiseSuppressionSettings();
    const next = { ...current, ...patch };
    localStorage.setItem(STORAGE.noiseSuppression, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
}

// ── Processor lifecycle ──────────────────────────────────────

type AudioTrackProcessor = TrackProcessor<Track.Kind.Audio, AudioProcessorOptions>;

// Threshold mode uses LiveKit's TrackProcessor API
let activeGateProcessor: AudioTrackProcessor | null = null;

// Automatic mode uses direct WebRTC sender replacement (bypasses TrackProcessor)
let activeRNNoise: RNNoiseHandle | null = null;
let originalRawTrack: MediaStreamTrack | null = null;

export interface LocalAudioTrackLike {
    setProcessor: (p: AudioTrackProcessor) => Promise<void>;
    stopProcessor: () => Promise<void>;
    mediaStreamTrack: MediaStreamTrack;
    sender: RTCRtpSender | undefined;
}

/**
 * Apply noise suppression to a LiveKit local audio track.
 * - "threshold" mode uses TrackProcessor (noise gate, reuses LiveKit's AudioContext)
 * - "automatic" mode replaces the WebRTC sender's track directly (keeps raw track alive)
 * Returns the processed MediaStreamTrack (for speaking indicator), or undefined for "off".
 */
export async function applyNoiseSuppressionToTrack(
    track: LocalAudioTrackLike,
): Promise<MediaStreamTrack | undefined> {
    const settings = getNoiseSuppressionSettings();

    // Tear down previous processors
    await teardown(track);

    if (settings.mode === "off") return undefined;

    if (settings.mode === "threshold") {
        const { createNoiseGateProcessor } = await import("./noiseGateProcessor");
        activeGateProcessor = createNoiseGateProcessor(settings.thresholdDb);
        await track.setProcessor(activeGateProcessor);
        return activeGateProcessor.processedTrack;
    }

    if (settings.mode === "automatic") {
        const { createRNNoiseStream } = await import("./rnnoiseProcessor");
        const rawTrack = track.mediaStreamTrack;
        activeRNNoise = await createRNNoiseStream(rawTrack);
        originalRawTrack = rawTrack;

        // Replace ONLY the WebRTC sender's track — this swaps what goes over the wire
        // WITHOUT stopping the raw mic track (which our processor reads from).
        const sender = track.sender;
        if (sender) {
            await sender.replaceTrack(activeRNNoise.processedTrack);
        }
        return activeRNNoise.processedTrack;
    }

    return undefined;
}

async function teardown(track: LocalAudioTrackLike) {
    if (activeGateProcessor) {
        try { await track.stopProcessor(); } catch { /* may already be stopped */ }
        activeGateProcessor = null;
    }
    if (activeRNNoise) {
        // Restore original raw track on the WebRTC sender
        const sender = track.sender;
        if (sender && originalRawTrack) {
            await sender.replaceTrack(originalRawTrack).catch(e => logger.voice.warn("Failed to restore original track on sender", e));
        }
        activeRNNoise.destroy();
        activeRNNoise = null;
        originalRawTrack = null;
    }
}

export function getProcessedTrack(): MediaStreamTrack | undefined {
    return activeRNNoise?.processedTrack ?? activeGateProcessor?.processedTrack;
}

export function clearActiveProcessor() {
    if (activeRNNoise) { activeRNNoise.destroy(); activeRNNoise = null; }
    activeGateProcessor = null;
    originalRawTrack = null;
}
