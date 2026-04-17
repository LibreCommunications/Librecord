/**
 * Noise-suppression pipeline: AudioWorklet ↔ dedicated Web Worker ↔ RNNoise WASM.
 *
 * The previous implementation ran RNNoise on the *main thread* with two
 * postMessage hops per 10ms audio frame:
 *
 *     AudioWorklet ─ postMessage ─► main (WASM) ─ postMessage ─► AudioWorklet
 *
 * Any time the main thread blocked (React render, GC, another JS task),
 * frames queued, the worklet's output ring buffer ran dry, and the output
 * sample-for-sample was zeros. The remote listener heard the classic
 * "robotic voice": occasional audio followed by silence gaps at a
 * roughly ~10ms cadence.
 *
 * This implementation keeps the main thread off the audio critical path:
 *
 *     AudioWorklet ─ MessagePort ─► Web Worker (WASM) ─ MessagePort ─► AudioWorklet
 *
 * A MessageChannel is created on the main thread, one end handed to the
 * AudioWorklet via processorOptions, the other end transferred to the
 * Web Worker. From that point on, frames flow directly between the two
 * without going through main. React renders and main-thread jitter stop
 * affecting the audio output.
 *
 * Round-trip latency stays under a couple of ms even under main-thread
 * pressure, so the worklet's ring buffer rarely underruns.
 */

// Vite turns this into a Worker constructor. The worker bundles its own
// copy of @shiguredo/rnnoise-wasm (which includes the inlined WASM).
import RNNoiseWorker from "./rnnoiseWorker?worker";

export interface RNNoiseHandle {
    processedTrack: MediaStreamTrack;
    destroy: () => void;
}

// ── AudioWorklet source ─────────────────────────────────────────
//
// The worklet receives the MessagePort to the rnnoise worker via
// processorOptions. Its only job is:
//   - Accumulate incoming 128-sample blocks into 480-sample frames
//   - Send each frame to the worker over the direct port
//   - Receive denoised frames from the worker into a ring buffer
//   - Emit samples from the ring buffer to its output
//
// Because the worklet and worker communicate directly, the main thread
// is never in the critical path.
const RNNOISE_WORKLET = `
class RNNoiseProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        const opts = (options && options.processorOptions) || {};
        this.frameSize = opts.frameSize || 480;
        this.inBuf = new Float32Array(this.frameSize);
        this.inPos = 0;
        // ~500ms ring buffer at 48kHz mono. Generous so that any
        // worker-side hiccup short of half a second doesn't underrun.
        this.outRing = new Float32Array(24000);
        this.outW = 0;
        this.outR = 0;
        this.outAvail = 0;
        this.primed = false;

        // 30ms of silence prefill so the first few process() calls
        // don't read from an empty ring before the first denoised
        // frame arrives from the worker.
        this.prefill = 48 * 30;

        // The direct MessagePort to the rnnoise worker is delivered on
        // the worklet's built-in this.port, because MessagePort can't be
        // cloned through processorOptions — the main thread has to
        // transfer it explicitly. Until the port arrives we buffer
        // input frames locally; typically it arrives within the first
        // process() call.
        this.workerPort = null;
        this.pendingFrames = [];
        this.port.onmessage = (msg) => {
            if (msg.data && msg.data.type === "workerPort" && msg.data.port) {
                this.workerPort = msg.data.port;
                this.workerPort.onmessage = (m) => {
                    if (m.data.type === "denoised") {
                        const s = m.data.samples;
                        for (let i = 0; i < s.length; i++) {
                            this.outRing[this.outW] = s[i];
                            this.outW = (this.outW + 1) % this.outRing.length;
                        }
                        this.outAvail = Math.min(this.outAvail + s.length, this.outRing.length);
                        if (this.outAvail >= this.prefill) this.primed = true;
                    }
                };
                this.workerPort.start();

                // Flush any frames that accumulated before the port
                // arrived so the worker can start catching up.
                for (const copy of this.pendingFrames) {
                    this.workerPort.postMessage(
                        { type: "frame", samples: copy },
                        [copy.buffer],
                    );
                }
                this.pendingFrames = [];
            }
        };
    }

    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];
        if (!input || !input[0] || !output || !output[0]) return true;

        const inData = input[0];
        const outData = output[0];
        const len = inData.length;

        // Accumulate input into frame-sized chunks and ship to the worker.
        for (let i = 0; i < len; i++) {
            this.inBuf[this.inPos++] = inData[i];
            if (this.inPos >= this.frameSize) {
                const copy = new Float32Array(this.inBuf);
                if (this.workerPort) {
                    this.workerPort.postMessage(
                        { type: "frame", samples: copy },
                        [copy.buffer],
                    );
                } else if (this.pendingFrames.length < 10) {
                    // Buffer until the main thread transfers the port.
                    // Cap at 100ms of buffered input to avoid unbounded growth.
                    this.pendingFrames.push(copy);
                }
                this.inPos = 0;
            }
        }

        // Emit samples from the ring. While priming, emit silence so
        // we don't glitch at session start.
        if (!this.primed) {
            outData.fill(0);
            return true;
        }

        for (let i = 0; i < outData.length; i++) {
            if (this.outAvail > 0) {
                outData[i] = this.outRing[this.outR];
                this.outR = (this.outR + 1) % this.outRing.length;
                this.outAvail--;
            } else {
                // Brief worker stall — emit silence rather than glitch.
                outData[i] = 0;
            }
        }
        return true;
    }
}
registerProcessor("rnnoise-processor", RNNoiseProcessor);
`;

export async function createRNNoiseStream(rawTrack: MediaStreamTrack): Promise<RNNoiseHandle> {
    const ctx = new AudioContext({ sampleRate: 48000 });
    if (ctx.state === "suspended") await ctx.resume();

    const worker = new RNNoiseWorker();
    const channel = new MessageChannel();

    // Wait for the worker to finish loading WASM before we start sending
    // it frames. Without the handshake the first few frames could be
    // dropped while the worker is still initialising.
    const frameSize = await new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(
            () => reject(new Error("rnnoise worker init timeout")),
            5000,
        );
        worker.addEventListener("message", (e: MessageEvent) => {
            if (e.data?.type === "ready") {
                clearTimeout(timeout);
                resolve(e.data.frameSize ?? 480);
            }
        }, { once: true });
        worker.addEventListener("error", (e: ErrorEvent) => {
            clearTimeout(timeout);
            reject(new Error(`rnnoise worker error: ${e.message}`));
        }, { once: true });
        worker.postMessage({ type: "init", port: channel.port2 }, [channel.port2]);
    });

    // Load the AudioWorklet and hand it the other end of the channel.
    const workletBlob = new Blob([RNNOISE_WORKLET], { type: "application/javascript" });
    const workletUrl = URL.createObjectURL(workletBlob);
    try {
        await ctx.audioWorklet.addModule(workletUrl);
    } finally {
        URL.revokeObjectURL(workletUrl);
    }

    const stream = new MediaStream([rawTrack]);
    const source = ctx.createMediaStreamSource(stream);
    const dest = ctx.createMediaStreamDestination();

    const workletNode = new AudioWorkletNode(ctx, "rnnoise-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        // frameSize only — the port itself can't be cloned through
        // processorOptions (structured clone), it has to be *transferred*
        // through the worklet's own message port below.
        processorOptions: { frameSize },
    });

    // Transfer port1 to the worklet via its built-in .port. The worklet
    // stores it and uses it directly to talk to the worker — no main
    // thread involvement after this point.
    workletNode.port.postMessage({ type: "workerPort", port: channel.port1 }, [channel.port1]);

    source.connect(workletNode);
    workletNode.connect(dest);

    // Keep the audio graph alive with a silent destination connection.
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;
    workletNode.connect(silentGain);
    silentGain.connect(ctx.destination);

    const processedTrack = dest.stream.getAudioTracks()[0];

    return {
        processedTrack,
        destroy() {
            try { worker.postMessage({ type: "destroy" }); } catch { /* ignore */ }
            // Give the worker a moment to clean up before force-killing.
            setTimeout(() => {
                try { worker.terminate(); } catch { /* ignore */ }
            }, 100);
            try { source.disconnect(); } catch { /* ignore */ }
            try { workletNode.disconnect(); } catch { /* ignore */ }
            try { silentGain.disconnect(); } catch { /* ignore */ }
            try { dest.disconnect(); } catch { /* ignore */ }
            if (ctx.state !== "closed") ctx.close().catch(() => {});
        },
    };
}
