/// <reference types="vite/client" />

// Vite's `?worker` import suffix: resolves to a Worker constructor.
// Used by voice/rnnoiseProcessor.ts to spin up the rnnoise WASM worker.
declare module "*?worker" {
    const workerConstructor: {
        new(options?: { name?: string }): Worker;
    };
    export default workerConstructor;
}
