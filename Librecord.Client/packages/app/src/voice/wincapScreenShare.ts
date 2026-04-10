/**
 * Wincap screen share integration for Windows.
 *
 *   Video: WGC → MF hardware H.264 encoder (main process) → IPC encoded
 *          NAL units → WebCodecs VideoDecoder → MediaStreamTrackGenerator
 *          → publishTrack. No getDisplayMedia, no Chromium capture.
 *   Audio: TODO — wincap exposes WASAPI loopback but the renderer-side
 *          worklet bridge isn't wired up yet. Falls through silent.
 *
 * Mirrors pipecapScreenShare.ts in shape so livekitClient can branch
 * by platform with the same control flow.
 */

import { getWincapAPI, type WincapStartOptions } from "@librecord/domain";

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

export interface WincapCaptureResult {
    videoTrack: MediaStreamTrack;
    /** Source title for the toast — display name or window title. */
    sourceName?: string;
}

/**
 * Run the wincap capture flow:
 *   1. Enumerate sources, pick the primary display (no picker yet).
 *   2. Start the encoded H.264 capture in the main process.
 *   3. Wire WebCodecs VideoDecoder + MediaStreamTrackGenerator to feed
 *      decoded VideoFrames into a track LiveKit can publish.
 */
export async function startCapture(
    fps: number,
    bitrateBps: number,
): Promise<WincapCaptureResult | null> {
    const wincap = getWincapAPI();
    if (!wincap) return null;

    const sources = await wincap.listSources();
    const primary = sources.displays.find(d => d.primary) ?? sources.displays[0];
    if (!primary) return null;

    const Generator = (globalThis as unknown as {
        MediaStreamTrackGenerator?: new (init: { kind: "video" | "audio" }) => MediaStreamTrack & {
            writable: WritableStream<VideoFrame>;
        };
    }).MediaStreamTrackGenerator;
    if (!Generator) {
        // eslint-disable-next-line no-console
        console.warn("wincap: MediaStreamTrackGenerator unavailable — Electron < 41 or non-Chromium runtime");
        return null;
    }

    const generator = new Generator({ kind: "video" });
    const writer = generator.writable.getWriter();

    // VideoDecoder is a global in Chromium 94+ / Electron 41+.
    const VideoDecoderCtor = (globalThis as unknown as { VideoDecoder?: typeof VideoDecoder }).VideoDecoder;
    if (!VideoDecoderCtor) {
        // eslint-disable-next-line no-console
        console.warn("wincap: VideoDecoder unavailable");
        return null;
    }

    const decoder = new VideoDecoderCtor({
        output: (frame: VideoFrame) => {
            writer.write(frame).catch(() => { /* track closed */ });
        },
        error: (e) => {
            // eslint-disable-next-line no-console
            console.warn("wincap: VideoDecoder error", e);
        },
    });

    // We don't have an SPS/PPS extracted up front; the MF encoder emits
    // them in the first keyframe. configure() with a generic Annex-B
    // codec string and rely on in-band parameter sets.
    decoder.configure({
        codec: "avc1.640028", // H.264 High profile, level 4.0
        optimizeForLatency: true,
        // No description → annex-B mode (NAL units with start codes).
    });

    let gotKeyframe = false;

    const offEncoded = wincap.onEncoded((frame) => {
        // Drop everything before the first keyframe — the decoder will
        // error out on inter frames without a reference.
        if (!gotKeyframe) {
            if (!frame.keyframe) return;
            gotKeyframe = true;
        }
        try {
            const chunk = new EncodedVideoChunk({
                type: frame.keyframe ? "key" : "delta",
                timestamp: Number(BigInt(frame.timestampNs) / 1000n), // ns → µs
                data: frame.data,
            });
            decoder.decode(chunk);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("wincap: decode submit failed", e);
        }
    });

    const offError = wincap.onError((err) => {
        // eslint-disable-next-line no-console
        console.warn("wincap: native error", err);
    });

    const startOpts: WincapStartOptions = {
        sourceKind: "display",
        handle: primary.monitorHandle,
        fps,
        bitrateBps,
        keyframeIntervalMs: 2000,
        codec: "h264",
    };
    const ok = await wincap.startCapture(startOpts);
    if (!ok) {
        offEncoded();
        offError();
        try { decoder.close(); } catch { /* ignore */ }
        try { writer.close(); } catch { /* ignore */ }
        return null;
    }

    activeCleanup = () => {
        offEncoded();
        offError();
        wincap.stopCapture().catch(() => { /* ignore */ });
        try { decoder.close(); } catch { /* ignore */ }
        try { writer.close(); } catch { /* ignore */ }
        try { generator.stop(); } catch { /* ignore */ }
    };

    return {
        videoTrack: generator,
        sourceName: primary.name,
    };
}
