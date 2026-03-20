import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const BASE = process.env.E2E_BASE_URL ?? "https://localhost:5173";
export const API_URL = process.env.E2E_API_URL ?? "https://localhost:5111";

/** Unique suffix to avoid collisions across test runs. */
export function uid(): string {
    return Math.random().toString(36).slice(2, 8);
}

export interface TestUser {
    email: string;
    username: string;
    displayName: string;
    password: string;
}

export function makeUser(tag: string): TestUser {
    const id = uid();
    return {
        email: `${tag}-${id}@test.local`,
        username: `${tag}_${id}`,
        displayName: `${tag.charAt(0).toUpperCase() + tag.slice(1)} ${id}`,
        password: "TestPass123!",
    };
}

/** Wait for SignalR connections to be established. */
export async function waitForRealtime(page: Page, timeout = 10_000): Promise<void> {
    await expect
        .poll(
            () => page.evaluate(() => (window as any).__realtimeReady === true),
            { message: "Waiting for SignalR connections to be ready", timeout },
        )
        .toBe(true);
}

/** Register a new user and return the authenticated page (already at /app). */
export async function registerUser(
    browser: Browser,
    user: TestUser,
): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        permissions: ["camera", "microphone"],
    });
    const page = await context.newPage();

    await page.goto(`${BASE}/register`);
    await page.waitForLoadState("networkidle");

    // Fill registration form
    const inputs = page.locator("input");
    await inputs.nth(0).fill(user.email);       // Email
    await inputs.nth(1).fill(user.username);     // Username
    await inputs.nth(2).fill(user.displayName);  // Display Name
    await inputs.nth(3).fill(user.password);     // Password

    // Submit
    await page.getByRole("button", { name: /continue/i }).click();

    // Wait for redirect to /app
    await page.waitForURL(/\/app/, { timeout: 15_000 });

    // Wait for SignalR connections
    await waitForRealtime(page);

    return { context, page };
}

/** Login an existing user and return the authenticated page. */
export async function loginUser(
    browser: Browser,
    user: TestUser,
): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        permissions: ["camera", "microphone"],
    });
    const page = await context.newPage();

    await page.goto(`${BASE}/login`);
    await page.waitForLoadState("networkidle");

    const inputs = page.locator("input");
    await inputs.nth(0).fill(user.username);
    await inputs.nth(1).fill(user.password);

    await page.getByRole("button", { name: /log in/i }).click();
    await page.waitForURL(/\/app/, { timeout: 15_000 });

    // Wait for SignalR connections
    await waitForRealtime(page);

    return { context, page };
}

// ─── MEDIA VERIFICATION HELPERS ────────────────────────────────────────

/**
 * Asserts that at least one visible <video> on `receiverPage` is actively
 * rendering non-black frames. Works by drawing each video to an off-screen
 * canvas and sampling pixels.
 *
 * @param receiverPage  The page of the user who should be *receiving* video.
 * @param description   Human-readable label for error messages.
 * @param timeout       How long to poll before giving up (ms).
 */
export async function expectVideoPlaying(
    receiverPage: Page,
    description: string,
    timeout = 15_000,
): Promise<void> {
    await expect
        .poll(
            async () => {
                return receiverPage.evaluate(() => {
                    const videos = Array.from(document.querySelectorAll("video"));
                    for (const video of videos) {
                        // Skip hidden or detached videos
                        if (video.classList.contains("hidden")) continue;
                        if (!video.srcObject) continue;
                        if (video.videoWidth === 0 || video.videoHeight === 0) continue;
                        if (video.readyState < 2) continue; // HAVE_CURRENT_DATA

                        // Draw a frame to canvas and sample pixels
                        const canvas = document.createElement("canvas");
                        canvas.width = Math.min(video.videoWidth, 64);
                        canvas.height = Math.min(video.videoHeight, 64);
                        const ctx = canvas.getContext("2d")!;
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

                        // Check that at least some pixels are non-black (R+G+B > 30)
                        let nonBlackPixels = 0;
                        for (let i = 0; i < data.length; i += 4) {
                            if (data[i] + data[i + 1] + data[i + 2] > 30) {
                                nonBlackPixels++;
                            }
                        }
                        const totalPixels = canvas.width * canvas.height;
                        // If more than 5% of pixels are non-black, video is actually rendering
                        if (nonBlackPixels / totalPixels > 0.05) {
                            return true;
                        }
                    }
                    return false;
                });
            },
            {
                message: `Expected video to be rendering non-black frames (${description})`,
                timeout,
                intervals: [500, 1000, 1000, 2000, 2000],
            },
        )
        .toBe(true);
}

/**
 * Asserts that a specific <video> element (matched by a selector within the
 * receiver page) is rendering non-black content. Useful for distinguishing
 * camera video from screen share video.
 *
 * @param receiverPage  The page of the user who should be receiving.
 * @param videoSelector CSS selector that narrows down to the target <video>.
 * @param description   Human-readable label.
 * @param timeout       How long to poll.
 */
export async function expectSpecificVideoPlaying(
    receiverPage: Page,
    videoSelector: string,
    description: string,
    timeout = 15_000,
): Promise<void> {
    await expect
        .poll(
            async () => {
                return receiverPage.evaluate((sel) => {
                    const video = document.querySelector(sel) as HTMLVideoElement | null;
                    if (!video) return "no-element";
                    if (!video.srcObject) return "no-src";
                    if (video.videoWidth === 0 || video.videoHeight === 0) return "no-dimensions";
                    if (video.readyState < 2) return "not-ready";

                    const canvas = document.createElement("canvas");
                    canvas.width = Math.min(video.videoWidth, 64);
                    canvas.height = Math.min(video.videoHeight, 64);
                    const ctx = canvas.getContext("2d")!;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

                    let nonBlack = 0;
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i] + data[i + 1] + data[i + 2] > 30) nonBlack++;
                    }
                    const ratio = nonBlack / (canvas.width * canvas.height);
                    return ratio > 0.05 ? "playing" : `too-dark(${(ratio * 100).toFixed(1)}%)`;
                }, videoSelector);
            },
            {
                message: `Expected video "${videoSelector}" to render non-black frames (${description})`,
                timeout,
                intervals: [500, 1000, 1000, 2000, 2000],
            },
        )
        .toBe("playing");
}

/**
 * Asserts that the receiver page is actually receiving audio bytes through
 * WebRTC. Queries all RTCPeerConnections for inbound-rtp audio stats and
 * checks that bytesReceived > 0.
 *
 * Requires exposing RTCPeerConnection — we monkey-patch it once on the page.
 */
export async function injectWebRtcTracker(page: Page): Promise<void> {
    await page.evaluate(() => {
        if ((window as any).__rtcTracked) return;
        (window as any).__rtcTracked = true;
        (window as any).__rtcPeerConnections = [] as RTCPeerConnection[];

        const OrigPC = window.RTCPeerConnection;
        (window as any).RTCPeerConnection = function (
            this: RTCPeerConnection,
            ...args: any[]
        ) {
            const pc = new OrigPC(...args);
            (window as any).__rtcPeerConnections.push(pc);
            return pc;
        } as any;
        (window as any).RTCPeerConnection.prototype = OrigPC.prototype;
    });
}

/**
 * Asserts that audio bytes are being received over WebRTC on the given page.
 * Must call `injectWebRtcTracker(page)` BEFORE the WebRTC connection is made.
 */
export async function expectAudioReceiving(
    receiverPage: Page,
    description: string,
    timeout = 20_000,
): Promise<void> {
    await expect
        .poll(
            async () => {
                return receiverPage.evaluate(async () => {
                    const pcs: RTCPeerConnection[] =
                        (window as any).__rtcPeerConnections ?? [];
                    for (const pc of pcs) {
                        if (pc.connectionState === "closed") continue;
                        try {
                            const stats = await pc.getStats();
                            for (const [, report] of stats) {
                                if (
                                    report.type === "inbound-rtp" &&
                                    report.kind === "audio" &&
                                    report.bytesReceived > 0
                                ) {
                                    return report.bytesReceived;
                                }
                            }
                        } catch {
                            // PC may have been closed between check and getStats
                        }
                    }
                    return 0;
                });
            },
            {
                message: `Expected audio bytes to be received via WebRTC (${description})`,
                timeout,
                intervals: [1000, 2000, 2000, 3000, 3000],
            },
        )
        .toBeGreaterThan(0);
}

/**
 * Asserts that video bytes are being received over WebRTC on the given page.
 * Must call `injectWebRtcTracker(page)` BEFORE the WebRTC connection is made.
 */
export async function expectVideoReceiving(
    receiverPage: Page,
    description: string,
    timeout = 20_000,
): Promise<void> {
    await expect
        .poll(
            async () => {
                return receiverPage.evaluate(async () => {
                    const pcs: RTCPeerConnection[] =
                        (window as any).__rtcPeerConnections ?? [];
                    for (const pc of pcs) {
                        if (pc.connectionState === "closed") continue;
                        try {
                            const stats = await pc.getStats();
                            for (const [, report] of stats) {
                                if (
                                    report.type === "inbound-rtp" &&
                                    report.kind === "video" &&
                                    report.bytesReceived > 0
                                ) {
                                    return report.bytesReceived;
                                }
                            }
                        } catch {
                            // PC may have been closed
                        }
                    }
                    return 0;
                });
            },
            {
                message: `Expected video bytes to be received via WebRTC (${description})`,
                timeout,
                intervals: [1000, 2000, 2000, 3000, 3000],
            },
        )
        .toBeGreaterThan(0);
}

/**
 * Counts visible (non-hidden) <video> elements with an active srcObject on
 * the page. Useful for asserting that screen share tiles / camera tiles exist.
 */
export async function countActiveVideos(page: Page): Promise<number> {
    return page.evaluate(() => {
        return Array.from(document.querySelectorAll("video")).filter((v) => {
            if (v.classList.contains("hidden")) return false;
            if (!v.srcObject) return false;
            return v.videoWidth > 0 && v.videoHeight > 0;
        }).length;
    });
}

// ─── DEEP WEBRTC STATS HELPERS ─────────────────────────────────────────

export interface RtpStreamStats {
    kind: "audio" | "video";
    direction: "inbound" | "outbound";
    bytesReceived?: number;
    bytesSent?: number;
    packetsReceived?: number;
    packetsSent?: number;
    packetsLost?: number;
    jitter?: number;
    framesDecoded?: number;
    framesEncoded?: number;
    frameWidth?: number;
    frameHeight?: number;
    framesPerSecond?: number;
    codec?: string;
    ssrc?: number;
    trackIdentifier?: string;
}

export interface PeerConnectionSummary {
    connectionState: string;
    currentRoundTripTime?: number;
    availableOutgoingBitrate?: number;
    streams: RtpStreamStats[];
}

/**
 * Collects detailed WebRTC stats from all tracked RTCPeerConnections on the page.
 * Returns structured data for assertions. Must have called injectWebRtcTracker() first.
 */
export async function collectWebRtcStats(page: Page): Promise<PeerConnectionSummary[]> {
    return page.evaluate(async () => {
        const pcs: RTCPeerConnection[] = (window as any).__rtcPeerConnections ?? [];
        const summaries: PeerConnectionSummary[] = [];

        for (const pc of pcs) {
            if (pc.connectionState === "closed") continue;

            const summary: PeerConnectionSummary = {
                connectionState: pc.connectionState,
                streams: [],
            };

            try {
                const stats = await pc.getStats();
                const codecMap = new Map<string, string>();

                // First pass: collect codec info
                for (const [, report] of stats) {
                    if (report.type === "codec") {
                        codecMap.set(report.id, report.mimeType ?? "unknown");
                    }
                }

                for (const [, report] of stats) {
                    if (report.type === "candidate-pair" && report.state === "succeeded") {
                        summary.currentRoundTripTime = report.currentRoundTripTime;
                        summary.availableOutgoingBitrate = report.availableOutgoingBitrate;
                    }

                    if (report.type === "inbound-rtp") {
                        summary.streams.push({
                            kind: report.kind,
                            direction: "inbound",
                            bytesReceived: report.bytesReceived,
                            packetsReceived: report.packetsReceived,
                            packetsLost: report.packetsLost,
                            jitter: report.jitter,
                            framesDecoded: report.framesDecoded,
                            frameWidth: report.frameWidth,
                            frameHeight: report.frameHeight,
                            framesPerSecond: report.framesPerSecond,
                            codec: report.codecId ? codecMap.get(report.codecId) : undefined,
                            ssrc: report.ssrc,
                            trackIdentifier: report.trackIdentifier,
                        });
                    }

                    if (report.type === "outbound-rtp") {
                        summary.streams.push({
                            kind: report.kind,
                            direction: "outbound",
                            bytesSent: report.bytesSent,
                            packetsSent: report.packetsSent,
                            framesEncoded: report.framesEncoded,
                            frameWidth: report.frameWidth,
                            frameHeight: report.frameHeight,
                            framesPerSecond: report.framesPerSecond,
                            codec: report.codecId ? codecMap.get(report.codecId) : undefined,
                            ssrc: report.ssrc,
                            trackIdentifier: report.trackIdentifier,
                        });
                    }
                }
            } catch {
                // PC closed mid-read
            }

            summaries.push(summary);
        }

        return summaries;
    });
}

/**
 * Takes two snapshots of WebRTC stats separated by `durationMs` and computes
 * deltas (bytes/packets sent and received in the interval). Useful for
 * measuring live bitrate and packet loss rate.
 */
export async function measureStatsOverInterval(
    page: Page,
    durationMs = 3000,
): Promise<{
    audio: { bytesSent: number; bytesReceived: number; packetsSent: number; packetsReceived: number; packetsLost: number };
    video: { bytesSent: number; bytesReceived: number; packetsSent: number; packetsReceived: number; packetsLost: number };
}> {
    const snap = async () => collectWebRtcStats(page);

    const before = await snap();
    await page.waitForTimeout(durationMs);
    const after = await snap();

    function sumField(
        summaries: PeerConnectionSummary[],
        kind: "audio" | "video",
        direction: "inbound" | "outbound",
        field: keyof RtpStreamStats,
    ): number {
        let total = 0;
        for (const pc of summaries) {
            for (const s of pc.streams) {
                if (s.kind === kind && s.direction === direction) {
                    total += (s[field] as number) ?? 0;
                }
            }
        }
        return total;
    }

    function delta(kind: "audio" | "video") {
        return {
            bytesSent:
                sumField(after, kind, "outbound", "bytesSent") -
                sumField(before, kind, "outbound", "bytesSent"),
            bytesReceived:
                sumField(after, kind, "inbound", "bytesReceived") -
                sumField(before, kind, "inbound", "bytesReceived"),
            packetsSent:
                sumField(after, kind, "outbound", "packetsSent") -
                sumField(before, kind, "outbound", "packetsSent"),
            packetsReceived:
                sumField(after, kind, "inbound", "packetsReceived") -
                sumField(before, kind, "inbound", "packetsReceived"),
            packetsLost:
                sumField(after, kind, "inbound", "packetsLost") -
                sumField(before, kind, "inbound", "packetsLost"),
        };
    }

    return { audio: delta("audio"), video: delta("video") };
}

/**
 * Compares outbound stats from the sender with inbound stats on the receiver
 * and returns a comparison including packet loss ratio.
 */
export async function compareSenderReceiver(
    senderPage: Page,
    receiverPage: Page,
    kind: "audio" | "video",
): Promise<{
    senderPacketsSent: number;
    senderBytesSent: number;
    senderFramesEncoded?: number;
    senderFrameWidth?: number;
    senderFrameHeight?: number;
    senderFps?: number;
    senderCodec?: string;
    receiverPacketsReceived: number;
    receiverBytesReceived: number;
    receiverPacketsLost: number;
    receiverFramesDecoded?: number;
    receiverFrameWidth?: number;
    receiverFrameHeight?: number;
    receiverFps?: number;
    receiverJitter?: number;
    receiverCodec?: string;
    packetLossRatio: number;
    roundTripTime?: number;
}> {
    const [senderStats, receiverStats] = await Promise.all([
        collectWebRtcStats(senderPage),
        collectWebRtcStats(receiverPage),
    ]);

    // Aggregate outbound from sender.
    // With simulcast, there are multiple outbound-rtp reports per video track
    // (one per quality layer: q/h/f). Dynacast may pause some layers
    // (framesEncoded=0, frameWidth=undefined). We sum framesEncoded across
    // all layers and take the max resolution (the highest active layer).
    let senderPacketsSent = 0;
    let senderBytesSent = 0;
    let senderFramesEncoded: number | undefined;
    let senderFrameWidth: number | undefined;
    let senderFrameHeight: number | undefined;
    let senderFps: number | undefined;
    let senderCodec: string | undefined;

    for (const pc of senderStats) {
        for (const s of pc.streams) {
            if (s.kind === kind && s.direction === "outbound") {
                senderPacketsSent += s.packetsSent ?? 0;
                senderBytesSent += s.bytesSent ?? 0;
                if (kind === "video") {
                    // Sum frames across all simulcast layers
                    senderFramesEncoded = (senderFramesEncoded ?? 0) + (s.framesEncoded ?? 0);
                    // Take the highest resolution layer (max width)
                    if (s.frameWidth && (!senderFrameWidth || s.frameWidth > senderFrameWidth)) {
                        senderFrameWidth = s.frameWidth;
                        senderFrameHeight = s.frameHeight;
                    }
                    // Take the highest reported FPS
                    if (s.framesPerSecond && (!senderFps || s.framesPerSecond > senderFps)) {
                        senderFps = s.framesPerSecond;
                    }
                }
                if (s.codec) senderCodec = s.codec;
            }
        }
    }

    // Aggregate inbound on receiver
    let receiverPacketsReceived = 0;
    let receiverBytesReceived = 0;
    let receiverPacketsLost = 0;
    let receiverFramesDecoded: number | undefined;
    let receiverFrameWidth: number | undefined;
    let receiverFrameHeight: number | undefined;
    let receiverFps: number | undefined;
    let receiverJitter: number | undefined;
    let receiverCodec: string | undefined;
    let roundTripTime: number | undefined;

    for (const pc of receiverStats) {
        roundTripTime = pc.currentRoundTripTime;
        for (const s of pc.streams) {
            if (s.kind === kind && s.direction === "inbound") {
                receiverPacketsReceived += s.packetsReceived ?? 0;
                receiverBytesReceived += s.bytesReceived ?? 0;
                receiverPacketsLost += s.packetsLost ?? 0;
                if (kind === "video") {
                    // Sum frames decoded across all inbound tracks
                    receiverFramesDecoded = (receiverFramesDecoded ?? 0) + (s.framesDecoded ?? 0);
                    // Take the highest resolution
                    if (s.frameWidth && (!receiverFrameWidth || s.frameWidth > receiverFrameWidth)) {
                        receiverFrameWidth = s.frameWidth;
                        receiverFrameHeight = s.frameHeight;
                    }
                    if (s.framesPerSecond && (!receiverFps || s.framesPerSecond > receiverFps)) {
                        receiverFps = s.framesPerSecond;
                    }
                }
                if (s.jitter !== undefined) receiverJitter = s.jitter;
                if (s.codec) receiverCodec = s.codec;
            }
        }
    }

    const totalExpected = receiverPacketsReceived + receiverPacketsLost;
    const packetLossRatio = totalExpected > 0 ? receiverPacketsLost / totalExpected : 0;

    return {
        senderPacketsSent,
        senderBytesSent,
        senderFramesEncoded,
        senderFrameWidth,
        senderFrameHeight,
        senderFps,
        senderCodec,
        receiverPacketsReceived,
        receiverBytesReceived,
        receiverPacketsLost,
        receiverFramesDecoded,
        receiverFrameWidth,
        receiverFrameHeight,
        receiverFps,
        receiverJitter,
        receiverCodec,
        packetLossRatio,
        roundTripTime,
    };
}

/**
 * Snapshots a video element's frame and returns per-channel averages and
 * a pixel diversity score (0-1). Useful for verifying that the received
 * video actually has varied content rather than a solid color.
 */
export async function getVideoFrameAnalysis(
    page: Page,
): Promise<{
    found: boolean;
    avgR: number;
    avgG: number;
    avgB: number;
    uniqueColors: number;
    pixelDiversity: number;
} | null> {
    return page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll("video"));
        for (const video of videos) {
            if (video.classList.contains("hidden")) continue;
            if (!video.srcObject) continue;
            if (video.videoWidth === 0 || video.videoHeight === 0) continue;
            if (video.readyState < 2) continue;

            const w = Math.min(video.videoWidth, 64);
            const h = Math.min(video.videoHeight, 64);
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(video, 0, 0, w, h);
            const { data } = ctx.getImageData(0, 0, w, h);
            const totalPixels = w * h;

            let sumR = 0, sumG = 0, sumB = 0;
            const colorSet = new Set<string>();

            for (let i = 0; i < data.length; i += 4) {
                sumR += data[i];
                sumG += data[i + 1];
                sumB += data[i + 2];
                // Quantize to 4-bit per channel to count "unique" colors
                const qr = data[i] >> 4;
                const qg = data[i + 1] >> 4;
                const qb = data[i + 2] >> 4;
                colorSet.add(`${qr},${qg},${qb}`);
            }

            return {
                found: true,
                avgR: sumR / totalPixels,
                avgG: sumG / totalPixels,
                avgB: sumB / totalPixels,
                uniqueColors: colorSet.size,
                // Normalize: 1 unique color = 0 diversity, 4096 = 1.0
                pixelDiversity: Math.min(colorSet.size / 100, 1),
            };
        }
        return null;
    });
}
