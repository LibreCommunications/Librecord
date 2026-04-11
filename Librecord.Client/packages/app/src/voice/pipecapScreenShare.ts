/**
 * Pipecap screen share integration for Linux.
 *
 *   Video: PipeWire → /dev/shm BGRA → preload fs read → VideoFrame(BGRA)
 *          → MediaStreamTrackGenerator → publishTrack. No canvas/WebGL/
 *          captureStream — VideoFrame eats BGRA directly.
 *   Audio: pipecap IPC f32 chunks → AudioWorklet ring buffer →
 *          MediaStreamAudioDestinationNode → publishTrack.
 */

import { getPipecapAPI, getPipecapShmAPI } from "@librecord/domain";

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

interface PipecapCaptureResult {
    /** Real MediaStreamTrack from MediaStreamTrackGenerator. */
    videoTrack: MediaStreamTrack;
    /** Real MediaStreamTrack from MediaStreamAudioDestinationNode. */
    audioTrack?: MediaStreamTrack;
    /** App name auto-detected from the capture source (e.g. "firefox"). */
    detectedApp?: string;
}

/**
 * Run the full pipecap capture flow:
 *   1. Show portal picker
 *   2. Start PipeWire capture
 *   3. Open shared memory for frame reading
 *   4. Build MediaStreamTracks (video via MSTG, audio via worklet)
 *
 * Returns null if the user cancelled or pipecap is unavailable.
 */
export async function startCapture(fps: number, audio: boolean): Promise<PipecapCaptureResult | null> {
    const pipecap = getPipecapAPI();
    const shm = getPipecapShmAPI();
    if (!pipecap || !shm) return null;

    const pickerResult = await pipecap.showPicker(3); // 3 = monitors + windows
    if (!pickerResult || pickerResult.streams.length === 0) {
        return null;
    }

    const source = pickerResult.streams[0];
    const captureInfo = await pipecap.startCapture({
        nodeId: source.nodeId,
        fps,
        audio,
        sourceType: source.sourceType,
    });
    if (!captureInfo) return null;

    if (!shm.open(captureInfo.shmPath)) {
        pipecap.stopCapture();
        return null;
    }

    const video = createVideoTrack(shm, fps);
    const cleanups: (() => void)[] = [video.stop];
    let audioTrack: MediaStreamTrack | undefined;

    if (audio) {
        try {
            const a = await createAudioTrack(pipecap);
            audioTrack = a.track;
            cleanups.push(a.stop);
        } catch (e) {
            // Audio is best-effort: a worklet failure should not kill video.
            // eslint-disable-next-line no-console
            console.warn("pipecap: audio worklet setup failed, continuing without audio", e);
        }
    }

    activeCleanup = () => {
        cleanups.forEach(fn => { try { fn(); } catch { /* ignore */ } });
        try { video.track.stop(); } catch { /* ignore */ }
        if (audioTrack) { try { audioTrack.stop(); } catch { /* ignore */ } }
        shm.close();
        pipecap.stopCapture();
    };

    return {
        videoTrack: video.track,
        audioTrack,
        detectedApp: captureInfo.detectedApp,
    };
}

// ── Video track via MediaStreamTrackGenerator ─────────────────────

interface ShmAPI {
    readFrame(): { width: number; height: number; stride: number; data: ArrayBuffer } | null;
}

function createVideoTrack(shm: ShmAPI, fps: number): { track: MediaStreamTrack; stop: () => void } {
    // MediaStreamTrackGenerator is the WebCodecs/Insertable Streams way to
    // produce a MediaStreamTrack from arbitrary VideoFrames. Available in
    // Chromium/Electron without flags. The cast keeps TS happy without
    // pulling in the full WICG type package.
    const Generator = (globalThis as unknown as {
        MediaStreamTrackGenerator: new (init: { kind: "video" | "audio" }) => MediaStreamTrack & {
            writable: WritableStream<VideoFrame>;
        };
    }).MediaStreamTrackGenerator;

    if (!Generator) {
        throw new Error("MediaStreamTrackGenerator unavailable — Electron < 41 or non-Chromium runtime");
    }

    const generator = new Generator({ kind: "video" });
    const writer = generator.writable.getWriter();

    let running = true;
    const startUs = performance.now() * 1000;

    // We pace by setInterval at the requested fps. The MSTG output frame
    // rate is whatever we write — pacing here is what controls the encoder
    // input rate. setInterval is fine: callbacks are sub-millisecond and
    // the bottleneck used to be everything we just deleted.
    const intervalMs = Math.max(1, Math.floor(1000 / fps));
    const interval = setInterval(() => {
        if (!running) return;
        const frame = shm.readFrame();
        if (!frame) return;
        const { width, height, stride, data } = frame;
        try {
            const view = new Uint8Array(data);
            const videoFrame = new VideoFrame(view, {
                format: "BGRA",
                codedWidth: width,
                codedHeight: height,
                timestamp: Math.round(performance.now() * 1000 - startUs),
                layout: [{ offset: 0, stride }],
            });
            // writer.write returns a promise that resolves when the
            // downstream encoder accepts the frame; we don't await it
            // because we want to keep reading the next frame even if the
            // encoder is briefly busy. VideoFrame.close() must run though.
            writer.write(videoFrame).catch(() => {
                try { videoFrame.close(); } catch { /* ignore */ }
            });
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("pipecap: VideoFrame construct/write failed", e);
        }
    }, intervalMs);

    return {
        track: generator,
        stop: () => {
            running = false;
            clearInterval(interval);
            writer.close().catch(() => { /* ignore */ });
        },
    };
}

// ── Audio track via AudioWorklet ──────────────────────────────────

/**
 * AudioWorkletProcessor source: stereo-interleaved f32 ring buffer fed
 * via `port.postMessage` from the renderer, drained into the worklet
 * output. Replaces the deprecated ScriptProcessorNode path.
 */
const PIPECAP_AUDIO_WORKLET = `
class PipecapAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 1 second of stereo at 48kHz = 96k samples. Plenty of slack for
    // jitter without introducing audible latency.
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
        // Overflow: drop oldest by advancing tail.
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
      // Underflow: emit silence rather than glitch.
      for (let c = 0; c < channels; c++) out[c].fill(0);
    }
    return true;
  }
}
registerProcessor('pipecap-audio', PipecapAudioProcessor);
`;

async function createAudioTrack(
    pipecap: NonNullable<ReturnType<typeof getPipecapAPI>>,
): Promise<{ track: MediaStreamTrack; stop: () => void }> {
    const audioCtx = new AudioContext({ sampleRate: 48000 });
    const dest = audioCtx.createMediaStreamDestination();

    const blob = new Blob([PIPECAP_AUDIO_WORKLET], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    try {
        await audioCtx.audioWorklet.addModule(url);
    } finally {
        URL.revokeObjectURL(url);
    }

    const node = new AudioWorkletNode(audioCtx, "pipecap-audio", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
    });
    node.connect(dest);
    await audioCtx.resume();

    const unsubAudio = pipecap.onAudio((chunk: { channels: number; sampleRate: number; data: Uint8Array }) => {
        // Build a fresh Float32Array we can transfer ownership of so the
        // worklet thread can take it without an extra copy on its side.
        // chunk.data is a Buffer (Node) backed by a shared ArrayBuffer, so
        // we can't transfer that directly — copy into a standalone f32.
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
