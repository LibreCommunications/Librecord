// AudioWorkletProcessor for RNNoise noise suppression.
// Loaded via audioContext.audioWorklet.addModule("/rnnoise-worklet.js")
// Expects rnnoise.wasm at /rnnoise.wasm (from @jitsi/rnnoise-wasm)
//
// WASM export map (minified by Emscripten):
//   c = memory, d = __wasm_call_ctors, e = rnnoise_init, f = rnnoise_create,
//   g = malloc, h = rnnoise_destroy, i = free, j = rnnoise_process_frame, k = table
//
// WASM imports: module "a" with { a: emscripten_resize_heap, b: emscripten_memcpy_big }

const FRAME_SIZE = 480; // RNNoise frame size (10ms at 48kHz)

class RNNoiseProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._ready = false;
        this._destroyed = false;
        this._state = 0;
        this._inPtr = 0;
        this._outPtr = 0;
        this._inBuf = new Float32Array(FRAME_SIZE);
        this._outBuf = new Float32Array(FRAME_SIZE);
        this._inPos = 0;
        this._outPos = 0;
        this._outReady = 0;
        this._wasmMemory = null;
        this._HEAPU8 = null;
        this._HEAPF32 = null;

        this._init();
    }

    _updateHeapViews() {
        this._HEAPU8 = new Uint8Array(this._wasmMemory.buffer);
        this._HEAPF32 = new Float32Array(this._wasmMemory.buffer);
    }

    async _init() {
        try {
            const response = await fetch("/rnnoise.wasm");
            const wasmBytes = await response.arrayBuffer();

            // Provide Emscripten runtime stubs
            this._wasmMemory = null; // will be set from WASM export
            let wasmTable = null;

            const self = this;

            const importObject = {
                a: {
                    // emscripten_resize_heap
                    a(requestedSize) {
                        // RNNoise doesn't need heap growth in practice, but provide a stub
                        return 0; // false = failed
                    },
                    // emscripten_memcpy_big
                    b(dest, src, num) {
                        self._HEAPU8.copyWithin(dest, src, src + num);
                    },
                },
            };

            const { instance } = await WebAssembly.instantiate(wasmBytes, importObject);
            const wasm = instance.exports;

            // Extract memory and set up heap views
            this._wasmMemory = wasm.c; // exported memory
            wasmTable = wasm.k;        // exported table
            this._updateHeapViews();

            // Call constructors (__wasm_call_ctors)
            if (wasm.d) wasm.d();

            // Initialize RNNoise
            if (wasm.e) wasm.e(); // rnnoise_init

            // Create denoise state
            this._state = wasm.f(); // rnnoise_create
            if (!this._state) {
                console.error("[RNNoise] Failed to create denoise state");
                return;
            }

            // Allocate input/output buffers in WASM heap (float32 = 4 bytes)
            this._inPtr = wasm.g(FRAME_SIZE * 4);  // malloc
            this._outPtr = wasm.g(FRAME_SIZE * 4); // malloc

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

    process(inputs, outputs) {
        if (this._destroyed) return false;

        const input = inputs[0]?.[0];
        const output = outputs[0]?.[0];
        if (!input || !output) return true;

        if (!this._ready) {
            // Pass through while loading
            output.set(input);
            return true;
        }

        // Refresh heap views if memory grew
        if (this._HEAPF32.buffer !== this._wasmMemory.buffer) {
            this._updateHeapViews();
        }

        const blockSize = input.length; // typically 128
        let inputOffset = 0;
        let outputOffset = 0;

        while (outputOffset < blockSize) {
            // Emit buffered output samples first
            if (this._outReady > 0) {
                const toCopy = Math.min(this._outReady, blockSize - outputOffset);
                for (let i = 0; i < toCopy; i++) {
                    output[outputOffset + i] = this._outBuf[this._outPos + i];
                }
                this._outPos += toCopy;
                this._outReady -= toCopy;
                outputOffset += toCopy;
                continue;
            }

            // Accumulate input samples into frame buffer
            if (inputOffset < blockSize) {
                const spaceInFrame = FRAME_SIZE - this._inPos;
                const samplesToRead = Math.min(spaceInFrame, blockSize - inputOffset);
                for (let i = 0; i < samplesToRead; i++) {
                    this._inBuf[this._inPos + i] = input[inputOffset + i];
                }
                this._inPos += samplesToRead;
                inputOffset += samplesToRead;

                // When we have a full frame, process it
                if (this._inPos >= FRAME_SIZE) {
                    const inIdx = this._inPtr >> 2; // float32 index (divide by 4)
                    const outIdx = this._outPtr >> 2;

                    // Copy input to WASM heap (RNNoise expects short-range floats)
                    for (let i = 0; i < FRAME_SIZE; i++) {
                        this._HEAPF32[inIdx + i] = this._inBuf[i] * 32768;
                    }

                    // Process frame: rnnoise_process_frame(state, out, in)
                    this._wasm.j(this._state, this._outPtr, this._inPtr);

                    // Read output (convert back to [-1, 1])
                    for (let i = 0; i < FRAME_SIZE; i++) {
                        this._outBuf[i] = this._HEAPF32[outIdx + i] / 32768;
                    }

                    this._inPos = 0;
                    this._outPos = 0;
                    this._outReady = FRAME_SIZE;
                }
            } else {
                // No more input and no buffered output — fill with silence
                output[outputOffset] = 0;
                outputOffset++;
            }
        }

        return true;
    }
}

registerProcessor("rnnoise-processor", RNNoiseProcessor);
