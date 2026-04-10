/**
 * Wincap screen share integration for Windows.
 *
 *   Picker: shared in-app picker UI populated from wincap.listSources()
 *           with thumbnails composited from desktopCapturer (handled in
 *           the main process).
 *   Video:  WGC + MF hardware encoder → encoded NAL units (h264/hevc/av1)
 *           → IPC → WebCodecs VideoDecoder → MediaStreamTrackGenerator
 *           → publishTrack. No getDisplayMedia, no Chromium capture.
 *   Audio:  WASAPI loopback (system mix) → IPC float32 chunks →
 *           AudioWorklet ring buffer → MediaStreamAudioDestinationNode
 *           → publishTrack. Mirrors the pipecap audio path so the same
 *           ring buffer behaviour applies (drop-oldest on overflow,
 *           silence on underflow).
 *
 * Mirrors pipecapScreenShare.ts in shape so livekitClient can branch by
 * platform with the same control flow.
 */

import {
    getWincapAPI,
    type WincapAudioChunk,
    type WincapStartOptions,
} from "@librecord/domain";

let activeCleanup: (() => void) | null = null;

export function isActive(): boolean {
    return activeCleanup !== null;
}

export function stop(): void {
    if (activeCleanup) {
        activeCleanup();
        activeCleanup = null;
    }
}

export interface WincapCaptureResult {
    videoTrack: MediaStreamTrack;
    audioTrack?: MediaStreamTrack;
    sourceName?: string;
}

export type WincapCodec = "h264" | "hevc" | "av1";

interface StartOptions {
    fps: number;
    bitrateBps: number;
    audio: boolean;
    codec?: WincapCodec;
}

/**
 * Run the wincap capture flow:
 *   1. Show the wincap picker (returns chosen display/window).
 *   2. Start the encoded capture in the main process.
 *   3. Wire WebCodecs VideoDecoder + MediaStreamTrackGenerator.
 *   4. Optionally start WASAPI loopback audio + worklet bridge.
 */
export async function startCapture(options: StartOptions): Promise<WincapCaptureResult | null> {
    const wincap = getWincapAPI();
    if (!wincap) return null;

    // The preload always exposes window.wincap, but the main process
    // may have failed to require @librecord/wincap (missing native
    // module, wrong ABI, etc). Probe before invoking anything else so
    // callers can fall back instead of throwing on showPicker().
    try {
        const ok = await wincap.available();
        if (!ok) return null;
    } catch {
        return null;
    }

    const codec: WincapCodec = options.codec ?? "h264";

    const picked = await wincap.showPicker();
    if (!picked) return null;

    const video = await createVideoTrack(wincap, picked, options, codec);
    if (!video) return null;

    const cleanups: Array<() => void> = [video.stop];
    let audioTrack: MediaStreamTrack | undefined;

    if (options.audio) {
        try {
            const a = await createAudioTrack(wincap);
            audioTrack = a.track;
            cleanups.push(a.stop);
        } catch (e) {
            // Audio is best-effort.
            // eslint-disable-next-line no-console
            console.warn("wincap: audio worklet setup failed, continuing without audio", e);
        }
    }

    activeCleanup = () => {
        cleanups.forEach(fn => { try { fn(); } catch { /* ignore */ } });
        wincap.stopCapture().catch(() => { /* ignore */ });
        if (options.audio) wincap.stopAudio().catch(() => { /* ignore */ });
    };

    return { videoTrack: video.track, audioTrack, sourceName: picked.name };
}

// ── Video track via WebCodecs VideoDecoder + MediaStreamTrackGenerator ──

interface WincapAPILike {
    startCapture: (options: WincapStartOptions) => Promise<boolean>;
    stopCapture: () => Promise<void>;
    onEncoded: (cb: (frame: { data: Uint8Array; timestampNs: string; keyframe: boolean }) => void) => () => void;
    onError: (cb: (err: { component: string; hresult: number; message: string }) => void) => () => void;
    startAudio: (options?: { mode?: "systemLoopback" | "processLoopback"; pid?: number }) => Promise<boolean>;
    stopAudio: () => Promise<void>;
    onAudio: (cb: (chunk: WincapAudioChunk) => void) => () => void;
}

interface CodecConfig {
    /** WebCodecs codec string for VideoDecoder.configure(). */
    decoderCodec: string;
}

const CODEC_CONFIGS: Record<WincapCodec, CodecConfig> = {
    // H.264 High @ L4.0 — covers up to 1080p60. The MFT can negotiate
    // higher; the decoder will reconfigure if it sees a higher level in
    // the SPS.
    h264: { decoderCodec: "avc1.640028" },
    // HEVC Main @ L5.1 — 4K30. Annex-B in-band parameter sets, no
    // description blob — same as H.264.
    hevc: { decoderCodec: "hev1.1.6.L153.B0" },
    // AV1 Main Profile @ L5.1, 8-bit — covers up to 4K. Note that AV1
    // uses an OBU stream, not Annex-B; the wincap encoder emits OBUs
    // and WebCodecs accepts them as a raw byte stream when codec is av1.
    av1:  { decoderCodec: "av01.0.13M.08" },
};

async function createVideoTrack(
    wincap: WincapAPILike,
    picked: { kind: "display" | "window"; handle: string },
    options: StartOptions,
    codec: WincapCodec,
): Promise<{ track: MediaStreamTrack; stop: () => void } | null> {
    const Generator = (globalThis as unknown as {
        MediaStreamTrackGenerator?: new (init: { kind: "video" | "audio" }) => MediaStreamTrack & {
            writable: WritableStream<VideoFrame>;
        };
    }).MediaStreamTrackGenerator;
    if (!Generator) {
        // eslint-disable-next-line no-console
        console.warn("wincap: MediaStreamTrackGenerator unavailable — Electron < 41 or non-Chromium runtime");
        return null;
    }

    const VideoDecoderCtor = (globalThis as unknown as { VideoDecoder?: typeof VideoDecoder }).VideoDecoder;
    if (!VideoDecoderCtor) {
        // eslint-disable-next-line no-console
        console.warn("wincap: VideoDecoder unavailable");
        return null;
    }

    const generator = new Generator({ kind: "video" });
    const writer = generator.writable.getWriter();

    const decoder = new VideoDecoderCtor({
        output: (frame: VideoFrame) => {
            writer.write(frame).catch(() => {
                try { frame.close(); } catch { /* ignore */ }
            });
        },
        error: (e) => {
            // eslint-disable-next-line no-console
            console.warn("wincap: VideoDecoder error", e);
        },
    });

    decoder.configure({
        codec: CODEC_CONFIGS[codec].decoderCodec,
        optimizeForLatency: true,
    });

    let gotKeyframe = false;
    const offEncoded = wincap.onEncoded((frame) => {
        if (!gotKeyframe) {
            if (!frame.keyframe) return; // skip until first IDR/IRAP
            gotKeyframe = true;
        }
        try {
            const chunk = new EncodedVideoChunk({
                type: frame.keyframe ? "key" : "delta",
                timestamp: Number(BigInt(frame.timestampNs) / 1000n), // ns → µs
                data: frame.data,
            });
            decoder.decode(chunk);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("wincap: decode submit failed", e);
        }
    });

    const offError = wincap.onError((err) => {
        // eslint-disable-next-line no-console
        console.warn("wincap: native error", err);
    });

    const startOpts: WincapStartOptions = {
        sourceKind: picked.kind,
        handle: picked.handle,
        fps: options.fps,
        bitrateBps: options.bitrateBps,
        keyframeIntervalMs: 2000,
        codec,
    };
    const ok = await wincap.startCapture(startOpts);
    if (!ok) {
        offEncoded();
        offError();
        try { decoder.close(); } catch { /* ignore */ }
        try { writer.close(); } catch { /* ignore */ }
        return null;
    }

    return {
        track: generator,
        stop: () => {
            offEncoded();
            offError();
            try { decoder.close(); } catch { /* ignore */ }
            try { writer.close(); } catch { /* ignore */ }
            try { generator.stop(); } catch { /* ignore */ }
        },
    };
}

// ── Audio track via AudioWorklet ──────────────────────────────────

/**
 * AudioWorkletProcessor source: stereo-interleaved f32 ring buffer fed
 * via `port.postMessage` from the renderer thread, drained into the
 * worklet output. Identical pattern to pipecap's audio worklet.
 */
const WINCAP_AUDIO_WORKLET = `
class WincapAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 1 second of stereo at 48kHz = 96k samples. Plenty of slack.
    this.cap = 48000 * 2;
    this.ring = new Float32Array(this.cap);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
    this.port.onmessage = (e) => {
      const samples = e.data;
      const len = samples.length;
      if (len === 0) return;
      if (this.size + len > this.cap) {
        const drop = this.size + len - this.cap;
        this.tail = (this.tail + drop) % this.cap;
        this.size -= drop;
      }
      for (let i = 0; i < len; i++) {
        this.ring[this.head] = samples[i];
        this.head = (this.head + 1) % this.cap;
      }
      this.size += len;
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length === 0) return true;
    const channels = out.length;
    const frames = out[0].length;
    const needed = frames * channels;
    if (this.size >= needed) {
      for (let f = 0; f < frames; f++) {
        for (let c = 0; c < channels; c++) {
          out[c][f] = this.ring[this.tail];
          this.tail = (this.tail + 1) % this.cap;
        }
      }
      this.size -= needed;
    } else {
      for (let c = 0; c < channels; c++) out[c].fill(0);
    }
    return true;
  }
}
registerProcessor('wincap-audio', WincapAudioProcessor);
`;

async function createAudioTrack(
    wincap: WincapAPILike,
): Promise<{ track: MediaStreamTrack; stop: () => void }> {
    const audioCtx = new AudioContext({ sampleRate: 48000 });
    const dest = audioCtx.createMediaStreamDestination();

    const blob = new Blob([WINCAP_AUDIO_WORKLET], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    try {
        await audioCtx.audioWorklet.addModule(url);
    } finally {
        URL.revokeObjectURL(url);
    }

    const node = new AudioWorkletNode(audioCtx, "wincap-audio", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
    });
    node.connect(dest);
    await audioCtx.resume();

    const ok = await wincap.startAudio({ mode: "systemLoopback" });
    if (!ok) {
        try { node.disconnect(); } catch { /* ignore */ }
        await audioCtx.close().catch(() => { /* ignore */ });
        throw new Error("wincap.startAudio failed");
    }

    const unsubAudio = wincap.onAudio((chunk) => {
        // chunk.data is a Buffer (Node) backed by a shared ArrayBuffer;
        // copy into a standalone Float32Array we can transfer ownership of.
        const sampleCount = chunk.data.byteLength / 4;
        const copy = new Float32Array(sampleCount);
        new Uint8Array(copy.buffer).set(
            new Uint8Array(chunk.data.buffer, chunk.data.byteOffset, chunk.data.byteLength),
        );
        node.port.postMessage(copy, [copy.buffer]);
    });

    const audioTrack = dest.stream.getAudioTracks()[0];

    return {
        track: audioTrack,
        stop: () => {
            unsubAudio();
            try { node.disconnect(); } catch { /* ignore */ }
            audioCtx.close().catch(() => { /* ignore */ });
        },
    };
}
