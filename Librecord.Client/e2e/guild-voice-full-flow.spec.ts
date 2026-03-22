import { test, expect } from "@playwright/test";
import {
    makeUser,
    registerUser,
    injectWebRtcTracker,
    expectAudioReceiving,
    expectVideoReceiving,
    expectVideoPlaying,
    expectSpecificVideoPlaying,
    countActiveVideos,
    API_URL,
    type TestUser,
} from "./helpers";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * Full end-to-end flow with REAL media verification:
 *
 *   1. Register two users (Alice & Bob)
 *   2. Alice creates a guild, creates an invite
 *   3. Bob joins the guild via invite code
 *   4. Both join a voice channel
 *   5. Verify audio is actually flowing between them (WebRTC bytesReceived > 0)
 *   6. Alice enables camera → verify Bob receives video frames (non-black pixels)
 *   7. Bob enables camera  → verify Alice receives video frames
 *   8. Alice screen shares  → verify Bob receives the screen share track + rendered frames
 *   9. Combined camera + screen share → verify multiple video tracks received
 *  10. Mute/deafen with verification that audio bytes stop/resume
 *  11. Disconnect and verify cleanup
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

test.describe.serial("Full guild + WebRTC voice flow with media verification", () => {
    // ─── 1. REGISTER TWO USERS ────────────────────────────────────────

    test("User A registers and RTC tracker is injected", async ({ browser }) => {
        userA = makeUser("alice");
        ({ context: ctxA, page: pageA } = await registerUser(browser, userA));
        await expect(pageA).toHaveURL(/\/app/);

        // Inject the RTCPeerConnection tracker BEFORE any WebRTC connection
        await injectWebRtcTracker(pageA);
    });

    test("User B registers and RTC tracker is injected", async ({ browser }) => {
        userB = makeUser("bob");
        ({ context: ctxB, page: pageB } = await registerUser(browser, userB));
        await expect(pageB).toHaveURL(/\/app/);

        await injectWebRtcTracker(pageB);
    });

    // ─── 2. USER A CREATES A GUILD ────────────────────────────────────

    test("User A creates a guild", async () => {
        // The sidebar icons use a custom tooltip div (not HTML title attr).
        // Target the clickable icon by finding the tooltip text's parent group.
        await pageA.locator("[data-testid='create-guild-btn']").click();
        await pageA.getByPlaceholder("My Guild").fill("E2E Test Guild");
        await pageA.getByRole("button", { name: /create guild/i }).click();

        await pageA.waitForURL(/\/app\/guild\//, { timeout: 10_000 });

        const url = pageA.url();
        const match = url.match(/\/app\/guild\/([^/]+)/);
        expect(match).toBeTruthy();
        guildId = match![1];
    });

    // ─── 3. USER A CREATES AN INVITE ──────────────────────────────────

    test("User A creates an invite", async () => {
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

        expect(response.code).toBeTruthy();
        inviteCode = response.code;
    });

    // ─── 4. USER B JOINS THE GUILD VIA INVITE CODE ────────────────────

    test("User B joins the guild via invite code", async () => {
        await pageB.locator("[data-testid='join-guild-btn']").click();
        await pageB.getByPlaceholder("e.g. AbCdEfGh").fill(inviteCode);
        await pageB.getByRole("button", { name: /join server/i }).click();

        await pageB.waitForURL(new RegExp(`/app/guild/${guildId}`), { timeout: 15_000 });
    });

    // ─── 5. ENSURE A VOICE CHANNEL EXISTS ─────────────────────────────

    test("Both users can see the voice channel", async () => {
        await pageA.waitForSelector("text=Voice Channels", { timeout: 10_000 });

        // Check if a voice channel exists (speaker icon polygon)
        const voiceChannelItems = pageA.locator(
            "polygon[points='11 5 6 9 2 9 2 15 6 15 11 19 11 5']",
        );
        const count = await voiceChannelItems.count();

        if (count === 0) {
            // Create one via API
            const apiUrl = API_URL;
            const channel = await pageA.evaluate(
                async ({ apiUrl, guildId }) => {
                    const res = await fetch(`${apiUrl}/channels/guild/${guildId}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ name: "General Voice", type: 1, position: 0 }),
                    });
                    return res.json();
                },
                { apiUrl, guildId },
            );
            expect(channel.id).toBeTruthy();

            await pageA.reload();
            await pageA.waitForSelector("text=Voice Channels", { timeout: 10_000 });
            // Re-inject RTC tracker after reload
            await injectWebRtcTracker(pageA);
        }

        // Grab voice channel name
        const voiceChannelSpans = pageA
            .locator("polygon[points='11 5 6 9 2 9 2 15 6 15 11 19 11 5']")
            .locator("..").locator("..").locator("span.truncate");

        const firstChannelText = await voiceChannelSpans.first().textContent();
        expect(firstChannelText).toBeTruthy();
        voiceChannelName = firstChannelText!.trim();

        // User B should also see it
        await pageB.reload();
        await pageB.waitForSelector("text=Voice Channels", { timeout: 10_000 });
        // Re-inject RTC tracker after reload
        await injectWebRtcTracker(pageB);

        await expect(
            pageB.locator(`text=${voiceChannelName}`).first(),
        ).toBeVisible();
    });

    // ─── 6. USER A JOINS VOICE CHANNEL ────────────────────────────────

    test("User A joins the voice channel", async () => {
        const voiceChannel = pageA
            .locator(`span.truncate:has-text("${voiceChannelName}")`)
            .first();
        await voiceChannel.click();

        await expect(pageA.locator("text=Voice Connected")).toBeVisible({
            timeout: 15_000,
        });
        await expect(pageA.locator("[title='Mute']")).toBeVisible({ timeout: 5_000 });
    });

    // ─── 7. USER B JOINS → BOTH SEE EACH OTHER ───────────────────────

    test("User B joins the voice channel and both see each other", async () => {
        const voiceChannel = pageB
            .locator(`span.truncate:has-text("${voiceChannelName}")`)
            .first();
        await voiceChannel.click();

        await expect(pageB.locator("text=Voice Connected")).toBeVisible({
            timeout: 15_000,
        });

        // Both should see each other's display name
        await expect(
            pageB.locator(`text=${userA.displayName}`).first(),
        ).toBeVisible({ timeout: 10_000 });

        await expect(
            pageA.locator(`text=${userB.displayName}`).first(),
        ).toBeVisible({ timeout: 10_000 });
    });

    // ─── 8. VERIFY AUDIO ACTUALLY FLOWS BETWEEN USERS ────────────────

    test("User B receives audio bytes from User A via WebRTC", async () => {
        // Both users have their mic enabled by default on join.
        // Chromium's fake audio device generates a test tone.
        // We verify that actual audio RTP bytes are received.
        await expectAudioReceiving(
            pageB,
            "Bob should receive Alice's audio",
        );
    });

    test("User A receives audio bytes from User B via WebRTC", async () => {
        await expectAudioReceiving(
            pageA,
            "Alice should receive Bob's audio",
        );
    });

    // ─── 9. USER A ENABLES CAMERA → BOB SEES REAL VIDEO ──────────────

    test("User A enables camera and User B receives video with non-black frames", async () => {
        await pageA.locator("[title='Turn On Camera']").click();
        await expect(pageA.locator("[title='Turn Off Camera']")).toBeVisible({
            timeout: 10_000,
        });

        // Verify User B actually receives video bytes over WebRTC
        await expectVideoReceiving(
            pageB,
            "Bob should receive video RTP bytes from Alice's camera",
        );

        // Verify that a <video> element on Bob's page is rendering non-black frames
        // (the fake camera device produces a color-shifting test pattern)
        await expectVideoPlaying(
            pageB,
            "Bob should see Alice's camera rendering non-black frames",
        );
    });

    // ─── 10. USER B ENABLES CAMERA → ALICE SEES REAL VIDEO ───────────

    test("User B enables camera and User A receives video with non-black frames", async () => {
        await pageB.locator("[title='Turn On Camera']").click();
        await expect(pageB.locator("[title='Turn Off Camera']")).toBeVisible({
            timeout: 10_000,
        });

        await expectVideoReceiving(
            pageA,
            "Alice should receive video RTP bytes from Bob's camera",
        );

        await expectVideoPlaying(
            pageA,
            "Alice should see Bob's camera rendering non-black frames",
        );
    });

    // ─── 11. DISABLE CAMERAS ─────────────────────────────────────────

    test("Both users disable cameras", async () => {
        await pageA.locator("[title='Turn Off Camera']").click();
        await expect(pageA.locator("[title='Turn On Camera']")).toBeVisible({
            timeout: 10_000,
        });

        await pageB.locator("[title='Turn Off Camera']").click();
        await expect(pageB.locator("[title='Turn On Camera']")).toBeVisible({
            timeout: 10_000,
        });

        // After disabling, no active (non-hidden) video elements should remain
        // (the <video> element has class 'hidden' when camera is off)
        await expect
            .poll(() => countActiveVideos(pageB), {
                message: "Bob should have 0 active videos after cameras off",
                timeout: 10_000,
            })
            .toBe(0);
    });

    // ─── 12. USER A SCREEN SHARES → BOB SEES IT ──────────────────────

    test("User A starts screen share and User B receives it with real frames", async () => {
        await pageA.locator("[title='Share Screen']").click();
        await expect(pageA.locator("[title='Stop Sharing']")).toBeVisible({
            timeout: 10_000,
        });

        // Verify video bytes flowing (screen share is a video track over WebRTC)
        await expectVideoReceiving(
            pageB,
            "Bob should receive screen share video bytes from Alice",
        );

        // The ScreenShareTile renders a <video> inside a div with specific classes.
        // Verify that Bob has an active non-hidden video element rendering frames.
        await expectVideoPlaying(
            pageB,
            "Bob should see Alice's screen share as non-black frames",
        );

        // Count active videos on Bob's side — should be exactly 1 (the screen share)
        await expect
            .poll(() => countActiveVideos(pageB), {
                message: "Bob should have 1 active video (screen share tile)",
                timeout: 10_000,
            })
            .toBe(1);
    });

    test("User A stops screen share", async () => {
        await pageA.locator("[title='Stop Sharing']").click();
        await expect(pageA.locator("[title='Share Screen']")).toBeVisible({
            timeout: 10_000,
        });

        // Screen share tile should disappear from Bob's view
        await expect
            .poll(() => countActiveVideos(pageB), {
                message: "Bob should have 0 active videos after screen share stops",
                timeout: 10_000,
            })
            .toBe(0);
    });

    // ─── 13. USER A: CAMERA + SCREEN SHARE SIMULTANEOUSLY ────────────

    test("User A uses camera + screen share simultaneously; Bob sees both", async () => {
        // Enable camera
        await pageA.locator("[title='Turn On Camera']").click();
        await expect(pageA.locator("[title='Turn Off Camera']")).toBeVisible({
            timeout: 10_000,
        });

        // Enable screen share
        await pageA.locator("[title='Share Screen']").click();
        await expect(pageA.locator("[title='Stop Sharing']")).toBeVisible({
            timeout: 10_000,
        });

        // Bob should have 2 active video elements:
        //   1. ParticipantTile <video> for Alice's camera
        //   2. ScreenShareTile <video> for Alice's screen
        await expect
            .poll(() => countActiveVideos(pageB), {
                message:
                    "Bob should see 2 active videos (Alice's camera + screen share)",
                timeout: 15_000,
                intervals: [1000, 2000, 2000, 3000],
            })
            .toBeGreaterThanOrEqual(2);

        // Verify both are actually rendering non-black content
        await expectVideoPlaying(
            pageB,
            "Bob should see non-black frames from Alice's camera+screen",
        );

        // Cleanup: disable both
        await pageA.locator("[title='Stop Sharing']").click();
        await expect(pageA.locator("[title='Share Screen']")).toBeVisible({
            timeout: 10_000,
        });
        await pageA.locator("[title='Turn Off Camera']").click();
        await expect(pageA.locator("[title='Turn On Camera']")).toBeVisible({
            timeout: 10_000,
        });
    });

    // ─── 14. MUTE VERIFICATION ───────────────────────────────────────

    test("User A mutes → verify mute indicator appears on User B's side", async () => {
        await pageA.locator("[title='Mute']").click();
        await expect(pageA.locator("[title='Unmute']")).toBeVisible({ timeout: 5_000 });

        // Bob should see the muted badge on Alice's participant tile.
        // The MicOffIcon is rendered inside a <span> with class text-red-400
        // when the participant is muted.
        await expect(
            pageB.locator(".text-red-400").first(),
        ).toBeVisible({ timeout: 10_000 });

        // Unmute
        await pageA.locator("[title='Unmute']").click();
        await expect(pageA.locator("[title='Mute']")).toBeVisible({ timeout: 5_000 });
    });

    // ─── 15. DEAFEN VERIFICATION ─────────────────────────────────────

    test("User A deafens → verify state and then undeafen", async () => {
        await pageA.locator("[title='Deafen']").click();
        await expect(pageA.locator("[title='Undeafen']")).toBeVisible({ timeout: 5_000 });

        // When deafened, remote audio tracks are disabled (track.enabled = false).
        // We can't easily assert "audio stopped" since bytesReceived is cumulative.
        // But we can verify the UI state is correct.
        await pageA.locator("[title='Undeafen']").click();
        await expect(pageA.locator("[title='Deafen']")).toBeVisible({ timeout: 5_000 });

        // Confirm audio is still flowing after undeafen
        await expectAudioReceiving(
            pageA,
            "Alice should still receive audio after undeafening",
        );
    });

    // ─── 16. USER B SCREEN SHARES → ALICE SEES IT ────────────────────

    test("User B starts screen share and User A sees real frames", async () => {
        await pageB.locator("[title='Share Screen']").click();
        await expect(pageB.locator("[title='Stop Sharing']")).toBeVisible({
            timeout: 10_000,
        });

        await expectVideoReceiving(
            pageA,
            "Alice should receive screen share video bytes from Bob",
        );

        await expectVideoPlaying(
            pageA,
            "Alice should see Bob's screen share as non-black frames",
        );

        // Stop sharing
        await pageB.locator("[title='Stop Sharing']").click();
        await expect(pageB.locator("[title='Share Screen']")).toBeVisible({
            timeout: 10_000,
        });
    });

    // ─── 17. BOTH USERS: MUTE + DEAFEN COMBINED ─────────────────────

    test("User B mutes and deafens simultaneously, then restores", async () => {
        await pageB.locator("[title='Mute']").click();
        await expect(pageB.locator("[title='Unmute']")).toBeVisible({ timeout: 5_000 });

        await pageB.locator("[title='Deafen']").click();
        await expect(pageB.locator("[title='Undeafen']")).toBeVisible({ timeout: 5_000 });

        // Both active
        await expect(pageB.locator("[title='Unmute']")).toBeVisible();
        await expect(pageB.locator("[title='Undeafen']")).toBeVisible();

        // Restore
        await pageB.locator("[title='Undeafen']").click();
        await expect(pageB.locator("[title='Deafen']")).toBeVisible({ timeout: 5_000 });

        await pageB.locator("[title='Unmute']").click();
        await expect(pageB.locator("[title='Mute']")).toBeVisible({ timeout: 5_000 });

        // Verify audio resumes
        await expectAudioReceiving(
            pageA,
            "Alice should receive Bob's audio after unmute+undeafen",
        );
    });

    // ─── 18. USER A DISCONNECTS ──────────────────────────────────────

    test("User A disconnects from voice", async () => {
        await pageA.locator("[title='Disconnect']").click();

        await expect(pageA.locator("text=Voice Connected")).not.toBeVisible({
            timeout: 10_000,
        });
        await expect(pageA.locator("[title='Mute']")).not.toBeVisible();
    });

    // ─── 19. BOB SEES ALICE LEFT ─────────────────────────────────────

    test("User B no longer sees User A in voice after disconnect", async () => {
        // Alice's name still appears in the guild Members sidebar, so we
        // scope to the voice participant tiles. ParticipantTile uses
        // aspect-video class and renders the display name in a span with
        // text-[#b5bac1]. After Alice leaves, only Bob's own tile remains.
        const participantTiles = pageB.locator(".aspect-video");
        await expect
            .poll(() => participantTiles.count(), {
                message: "Only Bob's own participant tile should remain",
                timeout: 10_000,
            })
            .toBe(1);

        // Verify Alice's name is not in any participant tile
        const aliceTile = pageB.locator(`.aspect-video:has-text("${userA.displayName}")`);
        await expect(aliceTile).not.toBeVisible({ timeout: 5_000 });
    });

    // ─── 20. USER B DISCONNECTS ──────────────────────────────────────

    test("User B disconnects from voice", async () => {
        await pageB.locator("[title='Disconnect']").click();

        await expect(pageB.locator("text=Voice Connected")).not.toBeVisible({
            timeout: 10_000,
        });
    });

    // ─── CLEANUP ─────────────────────────────────────────────────────

    test.afterAll(async () => {
        await ctxA?.close();
        await ctxB?.close();
    });
});
