/**
 * Pipecap screen share integration for Linux.
 *
 * Handles PipeWire capture via pipecap's native module:
 * - Portal picker (showPicker) → native Wayland/X11 screen selection
 * - Video frames via shared memory (/dev/shm) → WebGL canvas → captureStream
 * - Audio chunks via IPC → ScriptProcessorNode → MediaStreamDestination
 *
 * Produces a standard MediaStream that LiveKit can publish.
 */

import { getPipecapAPI, getPipecapShmAPI } from "@librecord/domain";

let activeCleanup: (() => void) | null = null;

/** Whether a pipecap screen share is currently active. */
export function isActive(): boolean {
    return activeCleanup !== null;
}

/** Stop the active pipecap capture and clean up all resources. */
export function stop(): void {
    if (activeCleanup) {
        activeCleanup();
        activeCleanup = null;
    }
}

interface PipecapCaptureResult {
    /** MediaStream with video + optional audio tracks. */
    stream: MediaStream;
    /** App name auto-detected from the capture source (e.g. "firefox"). */
    detectedApp?: string;
}

/**
 * Run the full pipecap capture flow:
 * 1. Show portal picker
 * 2. Start PipeWire capture
 * 3. Open shared memory for frame reading
 * 4. Build MediaStream from frames + audio
 *
 * Returns null if the user cancelled or pipecap is unavailable.
 */
export async function startCapture(fps: number, audio: boolean): Promise<PipecapCaptureResult | null> {
    const pipecap = getPipecapAPI();
    const shm = getPipecapShmAPI();
    if (!pipecap || !shm) return null;

    // Show native portal picker
    const pickerResult = await pipecap.showPicker(3); // 3 = monitors + windows
    if (!pickerResult || pickerResult.streams.length === 0) {
        return null;
    }

    const source = pickerResult.streams[0];
    const captureInfo = await pipecap.startCapture({
        nodeId: source.nodeId,
        pipewireFd: pickerResult.pipewireFd,
        fps,
        audio,
        sourceType: source.sourceType,
    });
    if (!captureInfo) return null;

    if (!shm.open(captureInfo.shmPath)) {
        pipecap.stopCapture();
        return null;
    }

    const stream = buildMediaStream(pipecap, shm, fps, audio);

    activeCleanup = () => {
        stream.cleanups.forEach(fn => fn());
        stream.mediaStream.getTracks().forEach(t => t.stop());
        shm.close();
        pipecap.stopCapture();
    };

    return {
        stream: stream.mediaStream,
        detectedApp: captureInfo.detectedApp,
    };
}

// ── MediaStream construction ──────────────────────────────────────

function buildMediaStream(
    pipecap: NonNullable<ReturnType<typeof getPipecapAPI>>,
    shm: NonNullable<ReturnType<typeof getPipecapShmAPI>>,
    fps: number,
    includeAudio: boolean,
) {
    const cleanups: (() => void)[] = [];
    const mediaStream = new MediaStream();

    // Video track from shared memory frames
    const video = createVideoTrack(shm, fps);
    cleanups.push(video.stop);
    video.stream.getVideoTracks().forEach(t => mediaStream.addTrack(t));

    // Audio track from IPC chunks
    if (includeAudio) {
        const audio = createAudioTrack(pipecap);
        cleanups.push(audio.stop);
        audio.stream.getAudioTracks().forEach(t => mediaStream.addTrack(t));
    }

    return { mediaStream, cleanups };
}

function createVideoTrack(shm: NonNullable<ReturnType<typeof getPipecapShmAPI>>, fps: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    const gl = canvas.getContext("webgl2")!;

    // Shader: PipeWire delivers BGRA, canvas needs RGBA — swap B↔R on GPU
    const prog = createSwizzleProgram(gl);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, "pos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    let curW = 0, curH = 0;
    let running = true;

    const interval = setInterval(() => {
        if (!running) return;
        const frame = shm.readFrame();
        if (!frame) return;
        if (frame.width !== curW || frame.height !== curH) {
            canvas.width = frame.width;
            canvas.height = frame.height;
            gl.viewport(0, 0, frame.width, frame.height);
            curW = frame.width;
            curH = frame.height;
        }
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, frame.width, frame.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(frame.data));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }, Math.floor(1000 / fps));

    return {
        stream: canvas.captureStream(fps),
        stop: () => { running = false; clearInterval(interval); },
    };
}

function createSwizzleProgram(gl: WebGL2RenderingContext): WebGLProgram {
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, `#version 300 es
        in vec2 pos; out vec2 uv;
        void main() { uv = pos * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(pos, 0, 1); }
    `);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, `#version 300 es
        precision mediump float; in vec2 uv; uniform sampler2D tex; out vec4 color;
        void main() { vec4 c = texture(tex, uv); color = vec4(c.b, c.g, c.r, 1.0); }
    `);
    gl.compileShader(fs);

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    return prog;
}

function createAudioTrack(pipecap: NonNullable<ReturnType<typeof getPipecapAPI>>) {
    const audioCtx = new AudioContext({ sampleRate: 48000 });
    const dest = audioCtx.createMediaStreamDestination();
    let pendingSamples = new Float32Array(0);

    const unsubAudio = pipecap.onAudio((chunk) => {
        const f32 = new Float32Array(
            chunk.data.buffer,
            chunk.data.byteOffset,
            chunk.data.byteLength / 4,
        );
        const combined = new Float32Array(pendingSamples.length + f32.length);
        combined.set(pendingSamples);
        combined.set(f32, pendingSamples.length);
        pendingSamples = combined;
    });

    const channels = 2;
    const bufferSize = 4096;
    const processor = audioCtx.createScriptProcessor(bufferSize, 0, channels);
    processor.onaudioprocess = (e) => {
        const needed = bufferSize * channels;
        if (pendingSamples.length >= needed) {
            for (let ch = 0; ch < channels; ch++) {
                const output = e.outputBuffer.getChannelData(ch);
                for (let i = 0; i < bufferSize; i++) {
                    output[i] = pendingSamples[i * channels + ch] || 0;
                }
            }
            pendingSamples = pendingSamples.slice(needed);
        } else {
            for (let ch = 0; ch < channels; ch++) {
                e.outputBuffer.getChannelData(ch).fill(0);
            }
        }
    };
    processor.connect(dest);
    audioCtx.resume();

    return {
        stream: dest.stream,
        stop: () => { unsubAudio(); processor.disconnect(); audioCtx.close(); },
    };
}
