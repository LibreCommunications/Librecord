import { Rnnoise, type DenoiseState } from "@shiguredo/rnnoise-wasm";

export interface RNNoiseHandle {
    processedTrack: MediaStreamTrack;
    destroy: () => void;
}

// Singleton RNNoise instance (loads WASM once)
let rnnoisePromise: Promise<Rnnoise> | null = null;

function getRnnoise(): Promise<Rnnoise> {
    if (!rnnoisePromise) {
        rnnoisePromise = Rnnoise.load();
    }
    return rnnoisePromise;
}

// ── AudioWorklet-based RNNoise processor ────────────────────────────
//
// Replaces the deprecated ScriptProcessorNode approach. The worklet
// runs on a dedicated audio thread, avoiding main-thread jank.
//
// Architecture:
//   MediaStreamSource → AudioWorkletNode (RNNoise) → Destination
//
// The worklet receives raw PCM, accumulates 480-sample frames (RNNoise
// frame size), processes them, and outputs denoised audio. RNNoise WASM
// runs inside the worklet thread.

const RNNOISE_WORKLET = `
class RNNoiseProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.frameSize = options.processorOptions.frameSize || 480;
    this.inBuf = new Float32Array(this.frameSize);
    this.inPos = 0;
    this.outRing = new Float32Array(8192);
    this.outW = 0;
    this.outR = 0;
    this.outAvail = 0;
    this.denoiseState = null;
    this.ready = false;

    // Receive the DenoiseState handle from the main thread.
    // Since WASM can't be loaded in a worklet easily, we use a
    // message-passing approach: main thread processes frames and
    // sends denoised data back. This keeps RNNoise on the main
    // thread but removes ScriptProcessorNode's synchronous blocking.
    //
    // Alternative: inline the WASM in the worklet. But @shiguredo/rnnoise-wasm
    // uses fetch() which isn't available in worklets. The message-passing
    // approach is a pragmatic middle ground.
    this.port.onmessage = (e) => {
      if (e.data.type === 'denoised') {
        const samples = e.data.samples;
        for (let i = 0; i < samples.length; i++) {
          this.outRing[this.outW] = samples[i];
          this.outW = (this.outW + 1) % 8192;
        }
        this.outAvail += samples.length;
        if (this.outAvail > 8192) this.outAvail = 8192;
      }
    };
    this.ready = true;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;

    const inData = input[0];
    const outData = output[0];
    const len = inData.length;

    // Accumulate input into frame-sized chunks and send to main thread.
    for (let i = 0; i < len; i++) {
      this.inBuf[this.inPos++] = inData[i];
      if (this.inPos >= this.frameSize) {
        // Send frame to main thread for RNNoise processing.
        const copy = new Float32Array(this.inBuf);
        this.port.postMessage({ type: 'frame', samples: copy }, [copy.buffer]);
        this.inPos = 0;
      }
    }

    // Read denoised output from ring buffer.
    for (let i = 0; i < outData.length; i++) {
      if (this.outAvail > 0) {
        outData[i] = this.outRing[this.outR];
        this.outR = (this.outR + 1) % 8192;
        this.outAvail--;
      } else {
        outData[i] = 0;
      }
    }

    return true;
  }
}
registerProcessor('rnnoise-processor', RNNoiseProcessor);
`;

export async function createRNNoiseStream(rawTrack: MediaStreamTrack): Promise<RNNoiseHandle> {
    const ctx = new AudioContext({ sampleRate: 48000 });
    if (ctx.state === "suspended") await ctx.resume();

    const rnnoise = await getRnnoise();
    const denoiseState: DenoiseState = rnnoise.createDenoiseState();
    const FRAME_SIZE = rnnoise.frameSize; // 480

    const blob = new Blob([RNNOISE_WORKLET], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    try {
        await ctx.audioWorklet.addModule(url);
    } finally {
        URL.revokeObjectURL(url);
    }

    const stream = new MediaStream([rawTrack]);
    const source = ctx.createMediaStreamSource(stream);
    const dest = ctx.createMediaStreamDestination();

    const workletNode = new AudioWorkletNode(ctx, "rnnoise-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: { frameSize: FRAME_SIZE },
    });

    // Process frames sent from the worklet: run RNNoise on the main
    // thread (WASM), send denoised samples back. This is still faster
    // than ScriptProcessorNode because the worklet handles buffering
    // and timing on the audio thread — the main thread only does the
    // WASM compute without blocking the audio callback.
    workletNode.port.onmessage = (e) => {
        if (e.data?.type === "frame") {
            const pcmFrame = e.data.samples as Float32Array;
            // Convert to int16 range for RNNoise
            for (let i = 0; i < pcmFrame.length; i++) {
                pcmFrame[i] = pcmFrame[i] * 32768;
            }
            denoiseState.processFrame(pcmFrame);
            // Convert back to float
            for (let i = 0; i < pcmFrame.length; i++) {
                pcmFrame[i] = pcmFrame[i] / 32768;
            }
            workletNode.port.postMessage(
                { type: "denoised", samples: pcmFrame },
                [pcmFrame.buffer],
            );
        }
    };

    source.connect(workletNode);
    workletNode.connect(dest);

    // Silent connection to keep the audio graph alive.
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;
    workletNode.connect(silentGain);
    silentGain.connect(ctx.destination);

    const processedTrack = dest.stream.getAudioTracks()[0];

    return {
        processedTrack,
        destroy() {
            workletNode.port.onmessage = null;
            source.disconnect();
            workletNode.disconnect();
            silentGain.disconnect();
            dest.disconnect();
            denoiseState.destroy();
            if (ctx.state !== "closed") ctx.close().catch(() => {});
        },
    };
}
