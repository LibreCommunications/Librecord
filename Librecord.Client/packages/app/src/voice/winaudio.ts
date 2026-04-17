/**
 * Windows WASAPI loopback audio capture for screenshare.
 *
 * Video capture on Windows is handled natively by Chromium's
 * getDisplayMedia (single hardware H.264 encode, no IPC readback).
 * We only use @librecord/winaudio to grab per-process loopback audio —
 * something Chromium's getDisplayMedia can't do on Windows without
 * also capturing the whole system mix (which loops the Librecord voice
 * call back to remote participants as echo).
 *
 * Flow:  WASAPI loopback (system mix on Win10, or Win11 per-process
 *        excluding Librecord) → IPC float32 chunks → AudioWorklet ring
 *        buffer → MediaStreamAudioDestinationNode → publishTrack.
 */

import {
    getWinAudioAPI,
    type WinAudioChunk,
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

/** Start WASAPI loopback audio. Returns a MediaStreamTrack the caller
 *  can publish to LiveKit. Null if winaudio is unavailable (non-Windows
 *  build) or audio setup failed. */
export async function startAudioOnly(): Promise<{ audioTrack: MediaStreamTrack } | null> {
    const winaudio = getWinAudioAPI();
    if (!winaudio) return null;
    try {
        if (!(await winaudio.available())) return null;
    } catch {
        return null;
    }

    try {
        const a = await createAudioTrack(winaudio);
        activeCleanup = () => {
            try { a.stop(); } catch { /* ignore */ }
            winaudio.stopAudio().catch(() => { /* ignore */ });
        };
        return { audioTrack: a.track };
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("winaudio: audio-only setup failed", e);
        return null;
    }
}

interface WinAudioAPILike {
    available: () => Promise<boolean>;
    startAudio: (options?: { mode?: "systemLoopback" | "processLoopback"; pid?: number }) => Promise<boolean>;
    stopAudio: () => Promise<void>;
    onAudio: (cb: (chunk: WinAudioChunk) => void) => () => void;
}

// ── Audio track via AudioWorklet ──────────────────────────────────

const WINAUDIO_WORKLET = `
class WinAudioProcessor extends AudioWorkletProcessor {
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
registerProcessor('winaudio', WinAudioProcessor);
`;

async function createAudioTrack(
    winaudio: WinAudioAPILike,
): Promise<{ track: MediaStreamTrack; stop: () => void }> {
    const audioCtx = new AudioContext({ sampleRate: 48000 });
    const dest = audioCtx.createMediaStreamDestination();

    const blob = new Blob([WINAUDIO_WORKLET], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    try {
        await audioCtx.audioWorklet.addModule(url);
    } finally {
        URL.revokeObjectURL(url);
    }

    const node = new AudioWorkletNode(audioCtx, "winaudio", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
    });
    node.port.onmessage = (e) => {
        if (e.data?.type === "diag") {
            // eslint-disable-next-line no-console
            console.warn(`winaudio: overflows=${e.data.overflows} underflows=${e.data.underflows} buf=${e.data.bufferLevel}`);
        }
    };
    node.connect(dest);
    await audioCtx.resume();

    // Let the main process auto-select audio mode:
    // Win11 22000+: processLoopback excluding Librecord (no echo)
    // Older: systemLoopback fallback
    const ok = await winaudio.startAudio();
    if (!ok) {
        try { node.disconnect(); } catch { /* ignore */ }
        await audioCtx.close().catch(() => { /* ignore */ });
        throw new Error("winaudio.startAudio failed");
    }

    const unsubAudio = winaudio.onAudio((chunk) => {
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
