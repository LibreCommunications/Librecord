// AudioWorkletProcessor for RNNoise noise suppression.
// WASM binary is sent from the main thread via port.postMessage({ type: "wasm", data: ArrayBuffer })
//
// WASM export map (minified by Emscripten, from @jitsi/rnnoise-wasm):
//   c = memory, d = __wasm_call_ctors, e = rnnoise_init, f = rnnoise_create,
//   g = malloc, h = rnnoise_destroy, i = free, j = rnnoise_process_frame, k = table
//
// WASM imports: module "a" with { a: emscripten_resize_heap, b: emscripten_memcpy_big }

const FRAME_SIZE = 480; // RNNoise frame size (10ms at 48kHz)
const OUT_RING_SIZE = 960; // Output ring buffer (2 frames, plenty of room)

class RNNoiseProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._ready = false;
        this._destroyed = false;
        this._state = 0;
        this._inPtr = 0;
        this._outPtr = 0;
        this._wasmMemory = null;
        this._HEAPU8 = null;
        this._HEAPF32 = null;

        // Input accumulator (flat buffer, reset after each frame)
        this._inBuf = new Float32Array(FRAME_SIZE);
        this._inPos = 0;

        // Output ring buffer
        this._outRing = new Float32Array(OUT_RING_SIZE);
        this._outReadPos = 0;
        this._outWritePos = 0;
        this._outAvailable = 0;

        this.port.onmessage = (e) => {
            if (e.data?.type === "wasm") {
                this._initWasm(e.data.data);
            }
        };
    }

    _updateHeapViews() {
        this._HEAPU8 = new Uint8Array(this._wasmMemory.buffer);
        this._HEAPF32 = new Float32Array(this._wasmMemory.buffer);
    }

    async _initWasm(wasmBytes) {
        try {
            const self = this;

            const importObject = {
                a: {
                    a() { return 0; }, // emscripten_resize_heap
                    b(dest, src, num) { // emscripten_memcpy_big
                        self._HEAPU8.copyWithin(dest, src, src + num);
                    },
                },
            };

            const { instance } = await WebAssembly.instantiate(wasmBytes, importObject);
            const wasm = instance.exports;

            this._wasmMemory = wasm.c;
            this._updateHeapViews();

            if (wasm.d) wasm.d(); // __wasm_call_ctors
            if (wasm.e) wasm.e(); // rnnoise_init

            this._state = wasm.f(); // rnnoise_create
            if (!this._state) {
                console.error("[RNNoise] Failed to create denoise state");
                return;
            }

            this._inPtr = wasm.g(FRAME_SIZE * 4);  // malloc
            this._outPtr = wasm.g(FRAME_SIZE * 4);  // malloc

            if (!this._inPtr || !this._outPtr) {
                console.error("[RNNoise] Failed to allocate WASM memory");
                return;
            }

            this._wasm = wasm;
            this._ready = true;
        } catch (err) {
            console.error("[RNNoise] Worklet init failed:", err);
        }
    }

    _processFrame() {
        if (this._HEAPF32.buffer !== this._wasmMemory.buffer) {
            this._updateHeapViews();
        }

        const inIdx = this._inPtr >> 2;
        const outIdx = this._outPtr >> 2;

        // Copy input to WASM heap (RNNoise expects PCM-scale floats)
        for (let i = 0; i < FRAME_SIZE; i++) {
            this._HEAPF32[inIdx + i] = this._inBuf[i] * 32768;
        }

        // rnnoise_process_frame(state, out, in)
        this._wasm.j(this._state, this._outPtr, this._inPtr);

        // Read output and append to ring buffer
        for (let i = 0; i < FRAME_SIZE; i++) {
            this._outRing[this._outWritePos] = this._HEAPF32[outIdx + i] / 32768;
            this._outWritePos = (this._outWritePos + 1) % OUT_RING_SIZE;
        }
        this._outAvailable += FRAME_SIZE;
    }

    process(inputs, outputs) {
        if (this._destroyed) return false;

        const input = inputs[0]?.[0];
        const output = outputs[0]?.[0];
        if (!input || !output) return true;

        if (!this._ready) {
            output.set(input);
            return true;
        }

        const blockSize = input.length;

        // 1. Consume ALL input samples, processing frames as they fill
        for (let i = 0; i < blockSize; i++) {
            this._inBuf[this._inPos++] = input[i];
            if (this._inPos >= FRAME_SIZE) {
                this._processFrame();
                this._inPos = 0;
            }
        }

        // 2. Emit output from ring buffer (silence if not enough yet)
        for (let i = 0; i < blockSize; i++) {
            if (this._outAvailable > 0) {
                output[i] = this._outRing[this._outReadPos];
                this._outReadPos = (this._outReadPos + 1) % OUT_RING_SIZE;
                this._outAvailable--;
            } else {
                output[i] = 0;
            }
        }

        return true;
    }
}

registerProcessor("rnnoise-processor", RNNoiseProcessor);
