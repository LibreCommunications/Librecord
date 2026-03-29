import { Track } from "livekit-client";
import type { TrackProcessor, AudioProcessorOptions } from "livekit-client";
import { getNoiseSuppressionSettings } from "./noiseSuppression";

const ATTACK_TIME = 0.005;   // 5ms gate open
const RELEASE_TIME = 0.05;   // 50ms gate close
const HOLD_MS = 80;          // hold gate open 80ms after last above-threshold sample

export function createNoiseGateProcessor(
    initialThresholdDb: number,
): TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
    let ctx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let gate: GainNode | null = null;
    let dest: MediaStreamAudioDestinationNode | null = null;
    let rafId: number | null = null;
    let thresholdDb = initialThresholdDb;
    let lastAboveTime = 0;
    let _processedTrack: MediaStreamTrack | undefined;

    function onSettingsChanged(e: Event) {
        const detail = (e as CustomEvent).detail;
        if (detail.thresholdDb !== undefined) thresholdDb = detail.thresholdDb;
    }

    function pollGate() {
        if (!analyser || !gate || !ctx) return;
        const buf = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buf);

        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        const dB = rms > 0 ? 20 * Math.log10(rms) : -100;

        const now = performance.now();
        if (dB >= thresholdDb) {
            lastAboveTime = now;
            gate.gain.setTargetAtTime(1, ctx.currentTime, ATTACK_TIME);
        } else if (now - lastAboveTime > HOLD_MS) {
            gate.gain.setTargetAtTime(0, ctx.currentTime, RELEASE_TIME);
        }

        rafId = requestAnimationFrame(pollGate);
    }

    function buildGraph(track: MediaStreamTrack, audioContext: AudioContext) {
        ctx = audioContext;
        const stream = new MediaStream([track]);
        source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        gate = ctx.createGain();
        gate.gain.value = 0; // start closed
        dest = ctx.createMediaStreamDestination();

        source.connect(analyser);
        analyser.connect(gate);
        gate.connect(dest);

        _processedTrack = dest.stream.getAudioTracks()[0];
        lastAboveTime = 0;
        rafId = requestAnimationFrame(pollGate);
    }

    function teardownGraph() {
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
        source?.disconnect();
        analyser?.disconnect();
        gate?.disconnect();
        dest?.disconnect();
        source = null; analyser = null; gate = null; dest = null;
        _processedTrack = undefined;
    }

    const processor: TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> = {
        name: "noise-gate",

        get processedTrack() { return _processedTrack; },

        async init(opts: AudioProcessorOptions) {
            window.addEventListener("voice:noisesuppression:changed", onSettingsChanged);
            const settings = getNoiseSuppressionSettings();
            thresholdDb = settings.thresholdDb;
            buildGraph(opts.track, opts.audioContext);
        },

        async restart(opts: AudioProcessorOptions) {
            teardownGraph();
            buildGraph(opts.track, opts.audioContext);
        },

        async destroy() {
            window.removeEventListener("voice:noisesuppression:changed", onSettingsChanged);
            teardownGraph();
        },
    };

    return processor;
}
