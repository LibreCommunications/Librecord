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

export async function createRNNoiseStream(rawTrack: MediaStreamTrack): Promise<RNNoiseHandle> {
    const ctx = new AudioContext({ sampleRate: 48000 });
    if (ctx.state === "suspended") await ctx.resume();

    const rnnoise = await getRnnoise();
    const denoiseState: DenoiseState = rnnoise.createDenoiseState();
    const FRAME_SIZE = rnnoise.frameSize; // 480

    // Frame accumulator
    const frameBuf = new Float32Array(FRAME_SIZE);
    let framePos = 0;

    // Output ring buffer
    const RING_SIZE = 8192;
    const outRing = new Float32Array(RING_SIZE);
    let outWrite = 0;
    let outRead = 0;
    let outAvail = 0;

    function processFrame() {
        // Convert to int16 range for RNNoise
        const pcmFrame = new Float32Array(FRAME_SIZE);
        for (let i = 0; i < FRAME_SIZE; i++) {
            pcmFrame[i] = frameBuf[i] * 32768;
        }

        // Process — modifies pcmFrame in place
        denoiseState.processFrame(pcmFrame);

        // Convert back and write to ring buffer
        for (let i = 0; i < FRAME_SIZE; i++) {
            outRing[outWrite] = pcmFrame[i] / 32768;
            outWrite = (outWrite + 1) % RING_SIZE;
        }
        outAvail += FRAME_SIZE;
    }

    // Build audio graph
    const stream = new MediaStream([rawTrack]);
    const source = ctx.createMediaStreamSource(stream);
    const scriptNode = ctx.createScriptProcessor(4096, 1, 1);
    const dest = ctx.createMediaStreamDestination();

    scriptNode.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const output = e.outputBuffer.getChannelData(0);
        const len = input.length;

        for (let i = 0; i < len; i++) {
            frameBuf[framePos++] = input[i];
            if (framePos >= FRAME_SIZE) {
                processFrame();
                framePos = 0;
            }
        }

        for (let i = 0; i < len; i++) {
            if (outAvail > 0) {
                output[i] = outRing[outRead];
                outRead = (outRead + 1) % RING_SIZE;
                outAvail--;
            } else {
                output[i] = 0;
            }
        }
    };

    source.connect(scriptNode);
    scriptNode.connect(dest);
    // Silent connection to ctx.destination to keep audio graph alive
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;
    scriptNode.connect(silentGain);
    silentGain.connect(ctx.destination);

    const processedTrack = dest.stream.getAudioTracks()[0];

    return {
        processedTrack,
        destroy() {
            scriptNode.onaudioprocess = null;
            source.disconnect();
            scriptNode.disconnect();
            silentGain.disconnect();
            dest.disconnect();
            denoiseState.destroy();
            if (ctx.state !== "closed") ctx.close().catch(() => {});
        },
    };
}
