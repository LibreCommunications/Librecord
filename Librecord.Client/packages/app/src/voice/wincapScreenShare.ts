/**
 * Wincap screen share integration for Windows.
 *
 *   Picker: shared in-app picker UI populated from wincap.listSources()
 *           with thumbnails composited from desktopCapturer (handled in
 *           the main process).
 *   Video:  WGC + MF hardware encoder → H.264 NAL units → IPC →
 *           WebCodecs VideoDecoder → MediaStreamTrackGenerator →
 *           publishTrack with H.264 codec (hardware re-encode in
 *           Chromium). No getDisplayMedia, no Chromium capture.
 *   Audio:  WASAPI loopback (system mix) → IPC float32 chunks →
 *           AudioWorklet ring buffer → MediaStreamAudioDestinationNode
 *           → publishTrack.
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

export async function startCapture(options: StartOptions): Promise<WincapCaptureResult | null> {
    const wincap = getWincapAPI();
    if (!wincap) return null;

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

// ── Video track via WebCodecs decode → H.264 re-encode ─────────────
//
// Wincap hardware-encodes H.264 on the GPU. We decode the NAL units
// with WebCodecs VideoDecoder, pipe decoded VideoFrames into a
// MediaStreamTrackGenerator, and publish with H.264 codec so Chromium
// re-encodes with its own hardware H.264 encoder. The re-encode is
// fast because Chromium uses the same GPU encoder (NVENC/QSV/AMF).

interface WincapAPILike {
    startCapture: (options: WincapStartOptions) => Promise<boolean>;
    stopCapture: () => Promise<void>;
    onEncoded: (cb: (frame: { data: Uint8Array; timestampNs: string; keyframe: boolean }) => void) => () => void;
    onError: (cb: (err: { component: string; hresult: number; message: string }) => void) => () => void;
    startAudio: (options?: { mode?: "systemLoopback" | "processLoopback"; pid?: number }) => Promise<boolean>;
    stopAudio: () => Promise<void>;
    onAudio: (cb: (chunk: WincapAudioChunk) => void) => () => void;
}

const CODEC_CONFIGS: Record<WincapCodec, string> = {
    h264: "avc1.640028",
    hevc: "hev1.1.6.L153.B0",
    av1: "av01.0.13M.08",
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
        console.warn("wincap: MediaStreamTrackGenerator unavailable");
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
            // Backpressure: check if the writer is ready before writing.
            // If the encoder downstream is slow, drop this frame instead
            // of queueing unboundedly (screen share prefers freshness over
            // completeness).
            if (writer.desiredSize !== null && writer.desiredSize <= 0) {
                frame.close();
                return;
            }
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
        codec: CODEC_CONFIGS[codec],
        optimizeForLatency: true,
    });

    let gotKeyframe = false;
    const offEncoded = wincap.onEncoded((frame) => {
        if (!gotKeyframe) {
            if (!frame.keyframe) return;
            gotKeyframe = true;
        }
        try {
            const chunk = new EncodedVideoChunk({
                type: frame.keyframe ? "key" : "delta",
                timestamp: Number(BigInt(frame.timestampNs) / 1000n),
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
        keyframeIntervalMs: 1000,
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

const WINCAP_AUDIO_WORKLET = `
class WincapAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 1 second of stereo at 48kHz. Plenty of slack for IPC jitter.
    this.cap = 48000 * 2;
    this.ring = new Float32Array(this.cap);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
    this.overflows = 0;
    this.underflows = 0;
    this.lastDiag = 0;
    this.port.onmessage = (e) => {
      const samples = e.data;
      const len = samples.length;
      if (len === 0) return;
      if (this.size + len > this.cap) {
        // Overflow: drop oldest to maintain live latency.
        const drop = this.size + len - this.cap;
        this.tail = (this.tail + drop) % this.cap;
        this.size -= drop;
        this.overflows++;
      }
      // Bulk copy via subarray + set when the write doesn't wrap.
      const spaceToEnd = this.cap - this.head;
      if (len <= spaceToEnd) {
        this.ring.set(samples, this.head);
        this.head = (this.head + len) % this.cap;
      } else {
        this.ring.set(samples.subarray(0, spaceToEnd), this.head);
        this.ring.set(samples.subarray(spaceToEnd), 0);
        this.head = len - spaceToEnd;
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
      // Underflow: emit silence.
      for (let c = 0; c < channels; c++) out[c].fill(0);
      this.underflows++;
    }
    // Log diagnostics every ~5 seconds (48000/128 ≈ 375 calls/sec).
    if (++this.lastDiag >= 1875) {
      this.lastDiag = 0;
      if (this.overflows > 0 || this.underflows > 0) {
        this.port.postMessage({
          type: 'diag',
          overflows: this.overflows,
          underflows: this.underflows,
          bufferLevel: this.size,
        });
        this.overflows = 0;
        this.underflows = 0;
      }
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
    node.port.onmessage = (e) => {
        if (e.data?.type === "diag") {
            // eslint-disable-next-line no-console
            console.warn(`wincap audio: overflows=${e.data.overflows} underflows=${e.data.underflows} buf=${e.data.bufferLevel}`);
        }
    };
    node.connect(dest);
    await audioCtx.resume();

    const ok = await wincap.startAudio({ mode: "systemLoopback" });
    if (!ok) {
        try { node.disconnect(); } catch { /* ignore */ }
        await audioCtx.close().catch(() => { /* ignore */ });
        throw new Error("wincap.startAudio failed");
    }

    const unsubAudio = wincap.onAudio((chunk) => {
        // chunk.data is a Node Buffer backed by a shared ArrayBuffer that
        // can't be transferred directly. Copy into a fresh ArrayBuffer and
        // transfer ownership to the worklet (zero-copy on the postMessage
        // side, one memcpy total instead of two).
        const bytes = chunk.data.byteLength;
        const buf = new ArrayBuffer(bytes);
        new Uint8Array(buf).set(
            new Uint8Array(chunk.data.buffer, chunk.data.byteOffset, bytes),
        );
        node.port.postMessage(new Float32Array(buf), [buf]);
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
