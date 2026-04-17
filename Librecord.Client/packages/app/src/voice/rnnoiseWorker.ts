/// <reference lib="webworker" />
/**
 * Dedicated Web Worker running RNNoise WASM.
 *
 * Receives raw 480-sample Float32 frames from an AudioWorklet via a
 * MessagePort (not through the main thread), processes each frame
 * through RNNoise, and sends the denoised samples back over the same
 * port. Keeps the main thread entirely off the audio critical path.
 *
 * Loaded via Vite's `?worker` import in rnnoiseProcessor.ts so the
 * @shiguredo/rnnoise-wasm dependency gets bundled correctly.
 */

import { Rnnoise } from "@shiguredo/rnnoise-wasm";

interface InitMessage {
    type: "init";
    port: MessagePort;
}

interface DestroyMessage {
    type: "destroy";
}

interface FrameMessage {
    type: "frame";
    samples: Float32Array;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent<InitMessage | DestroyMessage>) => {
    if (e.data.type !== "init") return;

    const port = e.data.port;
    const rnnoise = await Rnnoise.load();
    const state = rnnoise.createDenoiseState();
    const FRAME_SIZE = rnnoise.frameSize; // 480

    port.onmessage = (msg: MessageEvent<FrameMessage | DestroyMessage>) => {
        if (msg.data.type === "frame") {
            const frame = msg.data.samples;
            // RNNoise expects int16 range in a Float32 container.
            for (let i = 0; i < frame.length; i++) frame[i] *= 32768;
            state.processFrame(frame);
            for (let i = 0; i < frame.length; i++) frame[i] /= 32768;
            port.postMessage({ type: "denoised", samples: frame }, [frame.buffer]);
        } else if (msg.data.type === "destroy") {
            try { state.destroy(); } catch { /* ignore */ }
            port.close();
            ctx.close();
        }
    };
    port.start();

    // Handshake back to the main thread.
    ctx.postMessage({ type: "ready", frameSize: FRAME_SIZE });
};
