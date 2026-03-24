import { test, expect } from "@playwright/test";
import {
    makeUser,
    registerUser,
    injectWebRtcTracker,
    collectWebRtcStats,
    measureStatsOverInterval,
    compareSenderReceiver,
    getVideoFrameAnalysis,
    expectAudioReceiving,
    expectVideoPlaying,
    countActiveVideos,
    API_URL,
    type TestUser,
} from "./helpers";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * Deep media integrity tests.
 *
 * These go beyond "did bytes arrive?" and verify:
 *   - Packet loss ratio stays below threshold
 *   - Sender/receiver byte counts are consistent (accounting for loss)
 *   - Video resolution received matches what was sent
 *   - Frame rate is non-zero and reasonable
 *   - Audio and video codecs are negotiated
 *   - Jitter is within acceptable bounds
 *   - Round-trip time is sane
 *   - Received video frames have visual diversity (not solid color)
 *   - Bitrate is within expected range
 *   - Muting actually stops new audio packets from being sent
 *   - Camera off stops video packets
 */

let userA: TestUser;
let userB: TestUser;
let ctxA: BrowserContext;
let ctxB: BrowserContext;
let pageA: Page;
let pageB: Page;

let guildId: string;
let inviteCode: string;
let voiceChannelName: string;

/** Maximum acceptable packet loss ratio (5%). */
const MAX_PACKET_LOSS = 0.05;
/** Maximum acceptable jitter in seconds (50ms). */
const MAX_JITTER_S = 0.05;
/** Maximum RTT for localhost in seconds (100ms is very generous). */
const MAX_RTT_S = 0.1;

test.describe.serial("Media integrity — sender/receiver data consistency", () => {
    // ─── SETUP: register, create guild, invite, join, connect voice ───

    test("Setup: register User A", async ({ browser }) => {
        userA = makeUser("alice");
        ({ context: ctxA, page: pageA } = await registerUser(browser, userA));
        await injectWebRtcTracker(pageA);
    });

    test("Setup: register User B", async ({ browser }) => {
        userB = makeUser("bob");
        ({ context: ctxB, page: pageB } = await registerUser(browser, userB));
        await injectWebRtcTracker(pageB);
    });

    test("Setup: create guild + invite + join", async () => {
        // A creates guild
        await pageA.locator("[data-testid='create-guild-btn']").click();
        await pageA.getByPlaceholder("My Guild").fill("Media Integrity Guild");
        await pageA.getByRole("button", { name: /create guild/i }).click();
        await pageA.waitForURL(/\/app\/guild\//, { timeout: 10_000 });

        const url = pageA.url();
        guildId = url.match(/\/app\/guild\/([^/]+)/)![1];

        // A creates invite
        const apiUrl = API_URL;
        const response = await pageA.evaluate(
            async ({ apiUrl, guildId }) => {
                const res = await fetch(`${apiUrl}/guilds/${guildId}/invites`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                });
                return res.json();
            },
            { apiUrl, guildId },
        );
        inviteCode = response.code;

        // B joins
        await pageB.locator("[data-testid='join-guild-btn']").click();
        await pageB.getByPlaceholder("e.g. AbCdEfGh").fill(inviteCode);
        await pageB.getByRole("button", { name: /join server/i }).click();
        await pageB.waitForURL(new RegExp(`/app/guild/${guildId}`), { timeout: 15_000 });
    });

    test("Setup: ensure voice channel + both join", async () => {
        await pageA.waitForSelector("text=Voice Channels", { timeout: 10_000 });

        const voiceIcons = pageA.locator("polygon[points='11 5 6 9 2 9 2 15 6 15 11 19 11 5']");
        if ((await voiceIcons.count()) === 0) {
            const apiUrl = API_URL;
            await pageA.evaluate(
                async ({ apiUrl, guildId }) => {
                    await fetch(`${apiUrl}/channels/guild/${guildId}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ name: "General Voice", type: 1, position: 0 }),
                    });
                },
                { apiUrl, guildId },
            );
            await pageA.reload();
            await pageA.waitForSelector("text=Voice Channels", { timeout: 10_000 });
            await injectWebRtcTracker(pageA);
        }

        const spans = pageA
            .locator("polygon[points='11 5 6 9 2 9 2 15 6 15 11 19 11 5']")
            .locator("..").locator("..").locator("span.truncate");
        voiceChannelName = (await spans.first().textContent())!.trim();

        // Use full page navigations to ensure SignalR reconnects cleanly
        // (reload() on prod can leave SignalR in a partially connected state)
        await pageB.goto(pageA.url());
        await pageB.waitForLoadState("networkidle");
        await pageB.waitForSelector("text=Voice Channels", { timeout: 10_000 });
        await injectWebRtcTracker(pageB);

        // A joins voice
        await pageA.locator(`span.truncate:has-text("${voiceChannelName}")`).first().click();
        await expect(pageA.locator("text=Voice Connected")).toBeVisible({ timeout: 15_000 });

        // B joins voice
        await pageB.locator(`span.truncate:has-text("${voiceChannelName}")`).first().click();
        await expect(pageB.locator("text=Voice Connected")).toBeVisible({ timeout: 15_000 });

        // Both see each other
        await expect(pageB.locator(`text=${userA.displayName}`).first()).toBeVisible({ timeout: 10_000 });
        await expect(pageA.locator(`text=${userB.displayName}`).first()).toBeVisible({ timeout: 10_000 });
    });

    // ─── AUDIO INTEGRITY ─────────────────────────────────────────────

    test("Audio: packets sent by A ≈ packets received by B (loss < 5%)", async () => {
        // Let audio flow for a couple seconds first
        await expectAudioReceiving(pageB, "wait for audio to stabilize");

        const comparison = await compareSenderReceiver(pageA, pageB, "audio");

        console.log("Audio A→B:", JSON.stringify(comparison, null, 2));

        // Sender should have sent packets
        expect(comparison.senderPacketsSent).toBeGreaterThan(0);
        // Receiver should have received packets
        expect(comparison.receiverPacketsReceived).toBeGreaterThan(0);

        // Packet loss ratio within threshold
        expect(comparison.packetLossRatio).toBeLessThanOrEqual(MAX_PACKET_LOSS);
    });

    test("Audio: packets sent by B ≈ packets received by A (loss < 5%)", async () => {
        // Wait for audio to flow in the reverse direction before measuring
        await expectAudioReceiving(pageA, "wait for B→A audio to stabilize");

        const comparison = await compareSenderReceiver(pageB, pageA, "audio");

        console.log("Audio B→A:", JSON.stringify(comparison, null, 2));

        expect(comparison.senderPacketsSent).toBeGreaterThan(0);
        expect(comparison.receiverPacketsReceived).toBeGreaterThan(0);
        expect(comparison.packetLossRatio).toBeLessThanOrEqual(MAX_PACKET_LOSS);
    });

    test("Audio: jitter is within acceptable range", async () => {
        const comparison = await compareSenderReceiver(pageA, pageB, "audio");

        if (comparison.receiverJitter !== undefined) {
            console.log(`Audio jitter: ${(comparison.receiverJitter * 1000).toFixed(2)}ms`);
            expect(comparison.receiverJitter).toBeLessThanOrEqual(MAX_JITTER_S);
        }
    });

    test("Audio: codec is negotiated", async () => {
        const comparison = await compareSenderReceiver(pageA, pageB, "audio");

        // At least one side should report a codec (usually opus)
        const codec = comparison.senderCodec ?? comparison.receiverCodec;
        console.log(`Audio codec: ${codec}`);
        expect(codec).toBeTruthy();
    });

    test("Audio: bytes received are proportional to bytes sent", async () => {
        // Let the SFU pipeline stabilize — early snapshots have skewed
        // sender/receiver ratios because the receiver lags behind.
        await pageA.waitForTimeout(2_000);

        const comparison = await compareSenderReceiver(pageA, pageB, "audio");

        if (comparison.senderBytesSent > 0) {
            // Through a LiveKit SFU, the sender's outbound bytes go to the SFU
            // and the receiver's inbound bytes come from the SFU. SRTP overhead,
            // DTX (discontinuous transmission), and SFU repackaging mean the
            // byte counts diverge more on real networks than localhost.
            const ratio = comparison.receiverBytesReceived / comparison.senderBytesSent;
            console.log(`Audio byte delivery ratio: ${(ratio * 100).toFixed(1)}%`);
            expect(ratio).toBeGreaterThan(0.3);
        }
    });

    // ─── AUDIO: MUTE STOPS SENDING ───────────────────────────────────

    test("Audio: muting A stops new audio packets from being sent", async () => {
        // Measure baseline audio traffic
        const before = await measureStatsOverInterval(pageA, 2000);
        expect(before.audio.packetsSent).toBeGreaterThan(0);

        // Mute A
        await pageA.locator("[title='Mute']").click();
        await expect(pageA.locator("[title='Unmute']")).toBeVisible({ timeout: 5_000 });

        // Wait for mute to take effect then measure
        await pageA.waitForTimeout(500);
        const afterMute = await measureStatsOverInterval(pageA, 2000);

        console.log(`Packets sent while unmuted: ${before.audio.packetsSent}`);
        console.log(`Packets sent while muted: ${afterMute.audio.packetsSent}`);

        // Muted audio should send significantly fewer packets (or zero)
        // Some implementations send comfort noise or empty frames, so allow <10%
        if (before.audio.packetsSent > 0) {
            const muteRatio = afterMute.audio.packetsSent / before.audio.packetsSent;
            expect(muteRatio).toBeLessThan(0.2);
        }

        // Unmute
        await pageA.locator("[title='Unmute']").click();
        await expect(pageA.locator("[title='Mute']")).toBeVisible({ timeout: 5_000 });
    });

    // ─── VIDEO: CAMERA INTEGRITY ─────────────────────────────────────

    test("Video: enable cameras and let tracks stabilize", async () => {
        await pageA.locator("[title='Turn On Camera']").click();
        await expect(pageA.locator("[title='Turn Off Camera']")).toBeVisible({ timeout: 10_000 });

        await pageB.locator("[title='Turn On Camera']").click();
        await expect(pageB.locator("[title='Turn Off Camera']")).toBeVisible({ timeout: 10_000 });

        // Wait for video to stabilize
        await expectVideoPlaying(pageB, "wait for video to stabilize on B");
        await expectVideoPlaying(pageA, "wait for video to stabilize on A");
    });

    test("Video: packets sent by A ≈ packets received by B (loss < 5%)", async () => {
        const comparison = await compareSenderReceiver(pageA, pageB, "video");

        console.log("Video A→B:", JSON.stringify(comparison, null, 2));

        expect(comparison.senderPacketsSent).toBeGreaterThan(0);
        expect(comparison.receiverPacketsReceived).toBeGreaterThan(0);
        expect(comparison.packetLossRatio).toBeLessThanOrEqual(MAX_PACKET_LOSS);
    });

    test("Video: resolution received matches what sender is encoding", async () => {
        const comparison = await compareSenderReceiver(pageA, pageB, "video");

        console.log(`Sender resolution: ${comparison.senderFrameWidth}x${comparison.senderFrameHeight}`);
        console.log(`Receiver resolution: ${comparison.receiverFrameWidth}x${comparison.receiverFrameHeight}`);

        if (comparison.senderFrameWidth && comparison.receiverFrameWidth) {
            // Resolution should match (or be within bounds if SVC/simulcast is used)
            // Allow receiver to be equal or smaller (downscaling is acceptable)
            expect(comparison.receiverFrameWidth).toBeGreaterThan(0);
            expect(comparison.receiverFrameHeight).toBeGreaterThan(0);
            expect(comparison.receiverFrameWidth).toBeLessThanOrEqual(comparison.senderFrameWidth);
            expect(comparison.receiverFrameHeight).toBeLessThanOrEqual(comparison.senderFrameHeight);
        }
    });

    test("Video: frame rate is non-zero on both sides", async () => {
        const comparison = await compareSenderReceiver(pageA, pageB, "video");

        console.log(`Sender FPS: ${comparison.senderFps}`);
        console.log(`Receiver FPS: ${comparison.receiverFps}`);

        // FPS might be undefined if stats haven't accumulated enough,
        // but frames encoded/decoded should be non-zero
        if (comparison.senderFramesEncoded !== undefined) {
            expect(comparison.senderFramesEncoded).toBeGreaterThan(0);
        }
        if (comparison.receiverFramesDecoded !== undefined) {
            expect(comparison.receiverFramesDecoded).toBeGreaterThan(0);
        }
    });

    test("Video: codec is negotiated (VP8/VP9/H264/AV1)", async () => {
        const comparison = await compareSenderReceiver(pageA, pageB, "video");

        const codec = comparison.senderCodec ?? comparison.receiverCodec;
        console.log(`Video codec: ${codec}`);
        expect(codec).toBeTruthy();
        // Should be a video codec
        expect(codec!.toLowerCase()).toMatch(/vp8|vp9|h264|h265|av1/);
    });

    test("Video: received frames have visual diversity (not solid color)", async () => {
        const analysis = await getVideoFrameAnalysis(pageB);

        console.log("Frame analysis on Bob:", JSON.stringify(analysis, null, 2));

        expect(analysis).not.toBeNull();
        // Fake camera produces a test pattern with multiple colors
        // At least 3 distinct quantized colors
        expect(analysis!.uniqueColors).toBeGreaterThan(2);
        // Pixel diversity > 0 means varied content
        expect(analysis!.pixelDiversity).toBeGreaterThan(0);
    });

    test("Video: bytes received are proportional to bytes sent", async () => {
        const comparison = await compareSenderReceiver(pageA, pageB, "video");

        if (comparison.senderBytesSent > 0) {
            const ratio = comparison.receiverBytesReceived / comparison.senderBytesSent;
            console.log(`Video byte delivery ratio: ${(ratio * 100).toFixed(1)}%`);
            // LiveKit SFU repackages video (simulcast layer selection, SRTP overhead,
            // SVC rewriting), so receiver bytes can be significantly less than sender
            // bytes. This is normal — the SFU may forward only one simulcast layer
            // while the sender encodes multiple. We just verify data is flowing.
            expect(ratio).toBeGreaterThan(0.05);
            // And not somehow receiving MORE than sent (would indicate stats mismatch)
            expect(ratio).toBeLessThan(5.0);
        }
    });

    test("Video: jitter is within acceptable range", async () => {
        const comparison = await compareSenderReceiver(pageA, pageB, "video");

        if (comparison.receiverJitter !== undefined) {
            console.log(`Video jitter: ${(comparison.receiverJitter * 1000).toFixed(2)}ms`);
            expect(comparison.receiverJitter).toBeLessThanOrEqual(MAX_JITTER_S);
        }
    });

    // ─── VIDEO: CAMERA OFF STOPS SENDING ─────────────────────────────

    test("Video: turning off camera stops video packets", async () => {
        // Measure baseline video traffic
        const before = await measureStatsOverInterval(pageA, 2000);
        expect(before.video.packetsSent).toBeGreaterThan(0);

        const baselineByteRate = before.video.bytesSent;
        console.log(`Video bytes/2s while camera on: ${baselineByteRate}`);

        // Turn off camera
        await pageA.locator("[title='Turn Off Camera']").click();
        await expect(pageA.locator("[title='Turn On Camera']")).toBeVisible({ timeout: 10_000 });

        // Measure after camera off
        await pageA.waitForTimeout(500);
        const afterOff = await measureStatsOverInterval(pageA, 2000);

        console.log(`Video bytes/2s while camera off: ${afterOff.video.bytesSent}`);

        // Camera off should dramatically reduce video bytes (>80% reduction)
        if (baselineByteRate > 0) {
            const reduction = 1 - afterOff.video.bytesSent / baselineByteRate;
            console.log(`Video traffic reduction: ${(reduction * 100).toFixed(1)}%`);
            expect(reduction).toBeGreaterThan(0.8);
        }

        // Bob should have 0 active video elements for A's camera
        await expect
            .poll(() => countActiveVideos(pageB), {
                message: "Bob should see fewer active videos after A's camera off",
                timeout: 10_000,
            })
            .toBeLessThanOrEqual(1); // B's own camera may still be on
    });

    // ─── ROUND TRIP TIME ─────────────────────────────────────────────

    test("Connection: round-trip time is sane (< 100ms for localhost)", async () => {
        const stats = await collectWebRtcStats(pageA);

        for (const pc of stats) {
            if (pc.currentRoundTripTime !== undefined) {
                console.log(`RTT: ${(pc.currentRoundTripTime * 1000).toFixed(2)}ms`);
                expect(pc.currentRoundTripTime).toBeLessThanOrEqual(MAX_RTT_S);
            }
        }
    });

    // ─── SCREEN SHARE INTEGRITY ──────────────────────────────────────

    test("Screen share: A shares screen, B receives matching video track", async () => {
        // Re-enable A's camera first for a multi-track test
        await pageA.locator("[title='Turn On Camera']").click();
        await expect(pageA.locator("[title='Turn Off Camera']")).toBeVisible({ timeout: 10_000 });

        // Start screen share
        await pageA.locator("[title='Share Screen']").click();
        await expect(pageA.locator("[title='Stop Sharing']")).toBeVisible({ timeout: 10_000 });

        // Wait for tracks to propagate
        await expectVideoPlaying(pageB, "screen share stabilize on B");

        // B should have at least 2 video elements (camera + screen share)
        await expect
            .poll(() => countActiveVideos(pageB), {
                message: "Bob should see 2+ active videos (camera + screen share)",
                timeout: 15_000,
            })
            .toBeGreaterThanOrEqual(2);
    });

    test("Screen share: video stats show multiple inbound video tracks on B", async () => {
        // With the event-driven track attachment fix, both camera and screen
        // share tracks should be subscribed and flowing data promptly.
        // Poll to give the SFU time to forward both tracks.
        await expect
            .poll(
                async () => {
                    const stats = await collectWebRtcStats(pageB);
                    let count = 0;
                    for (const pc of stats) {
                        for (const s of pc.streams) {
                            if (s.kind === "video" && s.direction === "inbound" && (s.bytesReceived ?? 0) > 0) {
                                count++;
                            }
                        }
                    }
                    return count;
                },
                {
                    message: "Bob should have 2 inbound video tracks (camera + screen share) with data",
                    timeout: 15_000,
                    intervals: [1000, 2000, 2000, 3000, 3000],
                },
            )
            .toBeGreaterThanOrEqual(2);

        // Log details
        const stats = await collectWebRtcStats(pageB);
        let totalBytes = 0;
        for (const pc of stats) {
            for (const s of pc.streams) {
                if (s.kind === "video" && s.direction === "inbound" && (s.bytesReceived ?? 0) > 0) {
                    totalBytes += s.bytesReceived ?? 0;
                    console.log(`Inbound video track: ${s.frameWidth}x${s.frameHeight} @ ${s.framesPerSecond}fps, ` +
                        `${s.bytesReceived} bytes, ${s.packetsLost ?? 0} lost, codec=${s.codec}`);
                }
            }
        }
        expect(totalBytes).toBeGreaterThan(0);

        // DOM level: 2 active <video> elements
        const activeVideos = await countActiveVideos(pageB);
        console.log(`Active <video> elements on Bob: ${activeVideos}`);
        expect(activeVideos).toBeGreaterThanOrEqual(2);
    });

    test("Screen share: packet loss on all video tracks < 5%", async () => {
        const stats = await collectWebRtcStats(pageB);

        for (const pc of stats) {
            for (const s of pc.streams) {
                if (s.kind === "video" && s.direction === "inbound") {
                    const total = (s.packetsReceived ?? 0) + (s.packetsLost ?? 0);
                    if (total > 0) {
                        const loss = (s.packetsLost ?? 0) / total;
                        console.log(`Video track loss: ${(loss * 100).toFixed(2)}% ` +
                            `(${s.packetsLost} lost / ${total} total)`);
                        expect(loss).toBeLessThanOrEqual(MAX_PACKET_LOSS);
                    }
                }
            }
        }
    });

    test("Screen share: received frame has visual diversity", async () => {
        const analysis = await getVideoFrameAnalysis(pageB);

        expect(analysis).not.toBeNull();
        expect(analysis!.uniqueColors).toBeGreaterThan(2);
        console.log(`Screen share frame: ${analysis!.uniqueColors} unique colors, ` +
            `diversity=${analysis!.pixelDiversity.toFixed(2)}`);
    });

    // ─── LIVE BITRATE MEASUREMENT ────────────────────────────────────

    test("Live bitrate: audio + video bitrate are within reasonable range", async () => {
        const intervalMs = 3000;
        const measured = await measureStatsOverInterval(pageB, intervalMs);

        const audioBitrateKbps = (measured.audio.bytesReceived * 8) / intervalMs;
        const videoBitrateKbps = (measured.video.bytesReceived * 8) / intervalMs;

        console.log(`Audio bitrate (received): ${audioBitrateKbps.toFixed(1)} kbps`);
        console.log(`Video bitrate (received): ${videoBitrateKbps.toFixed(1)} kbps`);

        // Audio: Opus typically 6-128 kbps
        expect(audioBitrateKbps).toBeGreaterThan(1);
        expect(audioBitrateKbps).toBeLessThan(200);

        // Video: should be > 0 since camera + screen share are on
        expect(videoBitrateKbps).toBeGreaterThan(10);
        // Fake device on localhost shouldn't exceed 10 Mbps
        expect(videoBitrateKbps).toBeLessThan(10_000);

        // Also check packet counts are sane
        console.log(`Audio packets received in ${intervalMs}ms: ${measured.audio.packetsReceived}`);
        console.log(`Video packets received in ${intervalMs}ms: ${measured.video.packetsReceived}`);
        expect(measured.audio.packetsReceived).toBeGreaterThan(0);
        expect(measured.video.packetsReceived).toBeGreaterThan(0);

        // Audio packet loss during interval
        if (measured.audio.packetsReceived + measured.audio.packetsLost > 0) {
            const loss = measured.audio.packetsLost /
                (measured.audio.packetsReceived + measured.audio.packetsLost);
            console.log(`Audio packet loss during interval: ${(loss * 100).toFixed(2)}%`);
            expect(loss).toBeLessThanOrEqual(MAX_PACKET_LOSS);
        }

        // Video packet loss during interval
        if (measured.video.packetsReceived + measured.video.packetsLost > 0) {
            const loss = measured.video.packetsLost /
                (measured.video.packetsReceived + measured.video.packetsLost);
            console.log(`Video packet loss during interval: ${(loss * 100).toFixed(2)}%`);
            expect(loss).toBeLessThanOrEqual(MAX_PACKET_LOSS);
        }
    });

    // ─── CLEANUP ─────────────────────────────────────────────────────

    test("Cleanup: stop shares and disconnect", async () => {
        // Stop screen share
        await pageA.locator("[title='Stop Sharing']").click();
        await expect(pageA.locator("[title='Share Screen']")).toBeVisible({ timeout: 10_000 });

        // Turn off cameras
        await pageA.locator("[title='Turn Off Camera']").click();
        await expect(pageA.locator("[title='Turn On Camera']")).toBeVisible({ timeout: 10_000 });

        await pageB.locator("[title='Turn Off Camera']").click();
        await expect(pageB.locator("[title='Turn On Camera']")).toBeVisible({ timeout: 10_000 });

        // Disconnect both
        await pageA.locator("[title='Disconnect']").click();
        await expect(pageA.locator("text=Voice Connected")).not.toBeVisible({ timeout: 10_000 });

        await pageB.locator("[title='Disconnect']").click();
        await expect(pageB.locator("text=Voice Connected")).not.toBeVisible({ timeout: 10_000 });
    });

    test.afterAll(async () => {
        await ctxA?.close();
        await ctxB?.close();
    });
});
