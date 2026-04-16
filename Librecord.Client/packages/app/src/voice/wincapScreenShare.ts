/**
 * Wincap screen share integration for Windows.
 *
 *   Picker: shared in-app picker UI populated from wincap.listSources()
 *           with thumbnails composited from desktopCapturer (handled in
 *           the main process).
 *   Video:  WGC + MF hardware encoder → H.264 NAL units → IPC →
 *           WebCodecs VideoDecoder → MediaStreamTrackGenerator for
 *           local preview. An RTCRtpScriptTransform replaces Chromium's
 *           re-encoded output with wincap's original H.264 NALs,
 *           eliminating the double-encode quality loss. Falls back to
 *           Chromium re-encode if Encoded Transforms are unavailable.
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
    /** Attach an RTCRtpScriptTransform to the sender to bypass Chromium's
     *  re-encode and inject wincap's H.264 NALs directly. Returns false
     *  if Encoded Transforms are unavailable (falls back to re-encode). */
    attachEncodedTransform?: (sender: RTCRtpSender) => boolean;
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

    return {
        videoTrack: video.track,
        audioTrack,
        sourceName: picked.name,
        attachEncodedTransform: video.attachEncodedTransform,
    };
}

// ── Video track via WebCodecs decode (preview) + Encoded Transform ──
//
// Wincap hardware-encodes H.264 on the GPU. We decode the NAL units
// with WebCodecs VideoDecoder and pipe decoded VideoFrames into a
// MediaStreamTrackGenerator for local preview. After LiveKit publishes
// the track, an RTCRtpScriptTransform replaces Chromium's re-encoded
// output with wincap's original H.264 NALs — eliminating the double-
// encode and its quality loss. If Encoded Transforms are unavailable,
// Chromium's re-encode is used as a fallback.

interface WincapAPILike {
    startCapture: (options: WincapStartOptions) => Promise<boolean>;
    stopCapture: () => Promise<void>;
    requestKeyframe: () => Promise<void>;
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

// ── Encoded Transform worker ────────────────────────────────────
//
// Runs inside an RTCRtpScriptTransform. Receives wincap H.264 NALs
// from the main thread and injects them into the WebRTC sender,
// replacing Chromium's re-encoded output.

const ENCODED_TRANSFORM_WORKER = `
"use strict";
// Ring buffer of pending wincap NAL units (max 4 to handle jitter).
const MAX_PENDING = 4;
const pending = [];

self.onmessage = (e) => {
    if (e.data.type === "nal") {
        // Keep only the latest MAX_PENDING NALs.
        if (pending.length >= MAX_PENDING) pending.shift();
        pending.push({ data: e.data.data, keyframe: e.data.keyframe });
    }
};

self.onrtctransform = (event) => {
    const transformer = event.transformer;
    transformer.readable.pipeThrough(new TransformStream({
        transform(frame, controller) {
            const nal = pending.shift();
            if (nal) {
                // Replace Chromium's encoded data with wincap's NAL unit.
                frame.data = nal.data;
            }
            // If no pending NAL, pass through Chromium's encoded frame
            // (fallback — shouldn't happen often when wincap is producing).
            controller.enqueue(frame);
        }
    })).pipeTo(transformer.writable);
};
`;

/** Feature-detect RTCRtpScriptTransform support. */
function hasEncodedTransform(): boolean {
    return typeof (globalThis as unknown as { RTCRtpScriptTransform?: unknown }).RTCRtpScriptTransform === "function";
}

/** Create an encoded transform worker and return a NAL feeder + attach function. */
function createEncodedTransform(): {
    feedNal: (data: Uint8Array, keyframe: boolean) => void;
    attach: (sender: RTCRtpSender) => boolean;
    stop: () => void;
} | null {
    if (!hasEncodedTransform()) return null;

    const blob = new Blob([ENCODED_TRANSFORM_WORKER], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    URL.revokeObjectURL(url);

    const RTCRtpScriptTransformCtor = (globalThis as unknown as {
        RTCRtpScriptTransform: new (worker: Worker) => unknown;
    }).RTCRtpScriptTransform;

    return {
        feedNal(data: Uint8Array, keyframe: boolean) {
            // Copy into a transferable ArrayBuffer to avoid IPC overhead.
            const buf = new ArrayBuffer(data.byteLength);
            new Uint8Array(buf).set(data);
            worker.postMessage({ type: "nal", data: buf, keyframe }, [buf]);
        },
        attach(sender: RTCRtpSender): boolean {
            try {
                (sender as unknown as { transform: unknown }).transform =
                    new RTCRtpScriptTransformCtor(worker);
                // eslint-disable-next-line no-console
                console.info("wincap: encoded transform attached — bypassing Chromium re-encode");
                return true;
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn("wincap: failed to attach encoded transform, falling back to re-encode", e);
                return false;
            }
        },
        stop() {
            worker.terminate();
        },
    };
}

async function createVideoTrack(
    wincap: WincapAPILike,
    picked: { kind: "display" | "window"; handle: string },
    options: StartOptions,
    codec: WincapCodec,
): Promise<{ track: MediaStreamTrack; stop: () => void; attachEncodedTransform?: (sender: RTCRtpSender) => boolean } | null> {
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

    const VideoDecoderMaybe = (globalThis as unknown as { VideoDecoder?: typeof VideoDecoder }).VideoDecoder;
    if (!VideoDecoderMaybe) {
        // eslint-disable-next-line no-console
        console.warn("wincap: VideoDecoder unavailable");
        return null;
    }
    const VideoDecoderCtor: typeof VideoDecoder = VideoDecoderMaybe;

    const generator = new Generator({ kind: "video" });
    const writer = generator.writable.getWriter();

    const codecConfig: VideoDecoderConfig = {
        codec: CODEC_CONFIGS[codec],
        optimizeForLatency: true,
    };

    let droppedFrames = 0;
    let lastDropLog = 0;
    const outputHandler = (frame: VideoFrame) => {
        // Backpressure: check if the writer is ready before writing.
        // If the encoder downstream is slow, drop this frame instead
        // of queueing unboundedly (screen share prefers freshness over
        // completeness).
        if (writer.desiredSize !== null && writer.desiredSize <= 0) {
            frame.close();
            droppedFrames++;
            const now = Date.now();
            if (now - lastDropLog > 2000) {
                // eslint-disable-next-line no-console
                console.warn(`wincap: dropped ${droppedFrames} frames (backpressure)`);
                droppedFrames = 0;
                lastDropLog = now;
            }
            return;
        }
        writer.write(frame).catch(() => {
            try { frame.close(); } catch { /* ignore */ }
        });
    };

    function createDecoder(): InstanceType<typeof VideoDecoder> {
        return new VideoDecoderCtor({
            output: outputHandler,
            error: (e) => {
                // eslint-disable-next-line no-console
                console.warn("wincap: VideoDecoder error", e);
                // Codec reclaimed due to inactivity — recreate the decoder
                // and request a fresh keyframe to resume decoding.
                if (e.name === "QuotaExceededError" || decoder.state === "closed") {
                    try {
                        decoder = createDecoder();
                        decoder.configure(codecConfig);
                        gotKeyframe = false;
                        wincap.requestKeyframe().catch(() => { /* ignore */ });
                    } catch {
                        // eslint-disable-next-line no-console
                        console.warn("wincap: failed to recreate VideoDecoder");
                    }
                }
            },
        });
    }

    let decoder = createDecoder();
    decoder.configure(codecConfig);

    // Create encoded transform for bypassing Chromium re-encode.
    // If the browser doesn't support RTCRtpScriptTransform, this
    // returns null and we fall back to the decode → re-encode path.
    const transform = createEncodedTransform();

    let gotKeyframe = false;
    const offEncoded = wincap.onEncoded((frame) => {
        // Feed raw NALs to the encoded transform worker (if active).
        // This runs regardless of decoder state so the transform always
        // has fresh data to inject.
        if (transform) {
            transform.feedNal(frame.data, frame.keyframe);
        }

        // Decode path: feeds the MediaStreamTrackGenerator for preview
        // and provides timing/resolution info for WebRTC SDP negotiation.
        if (decoder.state === "closed") return;
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
        keyframeIntervalMs: 500,
        codec,
    };
    const ok = await wincap.startCapture(startOpts);
    if (!ok) {
        offEncoded();
        offError();
        transform?.stop();
        try { decoder.close(); } catch { /* ignore */ }
        try { writer.close(); } catch { /* ignore */ }
        return null;
    }

    return {
        track: generator,
        attachEncodedTransform: transform
            ? (sender: RTCRtpSender) => transform.attach(sender)
            : undefined,
        stop: () => {
            offEncoded();
            offError();
            transform?.stop();
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

    // Let the main process auto-select audio mode:
    // Win11 22000+: processLoopback excluding Librecord (no echo)
    // Older: systemLoopback fallback
    const ok = await wincap.startAudio();
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
