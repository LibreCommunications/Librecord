import { Rnnoise, type DenoiseState } from "@shiguredo/rnnoise-wasm";

// ── Public API ──────────────────────────────────────────────

export interface RNNoiseHandle {
    processedTrack: MediaStreamTrack;
    destroy: () => void;
}

// Singleton RNNoise instance (loads WASM once)
let rnnoisePromise: Promise<Rnnoise> | null = null;

function getRnnoise(): Promise<Rnnoise> {
    if (!rnnoisePromise) {
        rnnoisePromise = Rnnoise.load();
        rnnoisePromise.then(() => console.log("[RNNoise] Module loaded successfully"));
    }
    return rnnoisePromise;
}

export async function createRNNoiseStream(rawTrack: MediaStreamTrack): Promise<RNNoiseHandle> {
    const ctx = new AudioContext({ sampleRate: 48000 });
    if (ctx.state === "suspended") await ctx.resume();
    console.log(`[RNNoise] AudioContext sampleRate=${ctx.sampleRate}`);

    const rnnoise = await getRnnoise();
    const denoiseState: DenoiseState = rnnoise.createDenoiseState();
    const FRAME_SIZE = rnnoise.frameSize; // 480
    console.log(`[RNNoise] frameSize=${FRAME_SIZE}`);

    // Frame accumulator
    const frameBuf = new Float32Array(FRAME_SIZE);
    let framePos = 0;

    // Output ring buffer
    const RING_SIZE = 8192;
    const outRing = new Float32Array(RING_SIZE);
    let outWrite = 0;
    let outRead = 0;
    let outAvail = 0;

    // Diagnostics
    let frameCount = 0;
    let inRmsAcc = 0;
    let outRmsAcc = 0;
    let vadAcc = 0;

    function processFrame() {
        // Compute input RMS before processing
        let inSum = 0;
        for (let i = 0; i < FRAME_SIZE; i++) inSum += frameBuf[i] * frameBuf[i];
        inRmsAcc += Math.sqrt(inSum / FRAME_SIZE);

        // Convert to int16 range for RNNoise
        const pcmFrame = new Float32Array(FRAME_SIZE);
        for (let i = 0; i < FRAME_SIZE; i++) {
            pcmFrame[i] = frameBuf[i] * 32768;
        }

        // Process — modifies pcmFrame in place, returns VAD probability [0..1]
        const vad = denoiseState.processFrame(pcmFrame);
        vadAcc += vad;

        // Convert back and write to ring buffer
        let outSum = 0;
        for (let i = 0; i < FRAME_SIZE; i++) {
            const sample = pcmFrame[i] / 32768;
            outRing[outWrite] = sample;
            outWrite = (outWrite + 1) % RING_SIZE;
            outSum += sample * sample;
        }
        outAvail += FRAME_SIZE;
        outRmsAcc += Math.sqrt(outSum / FRAME_SIZE);

        frameCount++;
        if (frameCount % 100 === 0) {
            const n = 100;
            const avgIn = inRmsAcc / n;
            const avgOut = outRmsAcc / n;
            const avgVad = vadAcc / n;
            const reduction = avgIn > 0 ? ((1 - avgOut / avgIn) * 100).toFixed(1) : "N/A";
            console.log(
                `[RNNoise] frames=${frameCount} ` +
                `inRMS=${avgIn.toFixed(5)} outRMS=${avgOut.toFixed(5)} ` +
                `reduction=${reduction}% avgVAD=${avgVad.toFixed(3)}`
            );
            inRmsAcc = 0;
            outRmsAcc = 0;
            vadAcc = 0;
        }
    }

    // Build audio graph
    console.log(`[RNNoise] rawTrack: enabled=${rawTrack.enabled} readyState=${rawTrack.readyState}`);
    const stream = new MediaStream([rawTrack]);
    const source = ctx.createMediaStreamSource(stream);
    const scriptNode = ctx.createScriptProcessor(4096, 1, 1);
    const dest = ctx.createMediaStreamDestination();

    let firstCallback = true;
    scriptNode.onaudioprocess = (e) => {
        if (firstCallback) {
            firstCallback = false;
            console.log(`[RNNoise] onaudioprocess FIRST CALLBACK — sampleRate=${e.inputBuffer.sampleRate}`);
        }

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
