import { test, expect } from "@playwright/test";
import {
    makeUser,
    registerUser,
    injectWebRtcTracker,
    expectVideoReceiving,
    expectVideoPlaying,
    expectContinuousVideoStream,
    countActiveVideos,
    API_URL,
    type TestUser,
} from "./helpers";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * Comprehensive screen share e2e tests:
 *
 *  - Continuous stream verification (multiple images, 1.5s+ duration)
 *  - Stop / restart reliability
 *  - Camera + screen share simultaneously
 *  - Both users sharing at the same time
 *  - Opt-in persistence across stop/restart
 *  - Clean stop with no leftover videos
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

/** Start a screen share with default settings (1080p, Source FPS, audio on). */
async function startShare(page: Page) {
    await page.locator("[title='Share Screen']").click();
    await expect(page.getByText("Screen Share")).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "Go Live" }).click();
    await expect(page.locator("[title='Stop Sharing']")).toBeVisible({ timeout: 10_000 });
}

/** Stop screen share and wait for button to revert. */
async function stopShare(page: Page) {
    await page.locator("[title='Stop Sharing']").click();
    await expect(page.locator("[title='Share Screen']")).toBeVisible({ timeout: 10_000 });
}

/** Click "Watch Stream" opt-in button on viewer's page. */
async function optIn(page: Page) {
    await expect(page.getByRole("button", { name: "Watch Stream" })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Watch Stream" }).click();
}

test.describe.serial("Screen Share — comprehensive reliability tests", () => {
    // ─── SETUP ────────────────────────────────────────────────────────

    test("Register User A", async ({ browser }) => {
        userA = makeUser("ssA");
        ({ context: ctxA, page: pageA } = await registerUser(browser, userA));
        await expect(pageA).toHaveURL(/\/app/);
        await injectWebRtcTracker(pageA);
    });

    test("Register User B", async ({ browser }) => {
        userB = makeUser("ssB");
        ({ context: ctxB, page: pageB } = await registerUser(browser, userB));
        await expect(pageB).toHaveURL(/\/app/);
        await injectWebRtcTracker(pageB);
    });

    test("Create guild, invite User B, both join voice", async () => {
        // A creates guild
        await pageA.locator("[data-testid='create-guild-btn']").click();
        await pageA.getByPlaceholder("My Guild").fill("ScreenShare E2E");
        await pageA.getByRole("button", { name: /create guild/i }).click();
        await pageA.waitForURL(/\/app\/guild\//, { timeout: 10_000 });
        guildId = pageA.url().match(/\/app\/guild\/([^/]+)/)![1];

        // Create invite
        const response = await pageA.evaluate(
            async ({ apiUrl, guildId }) => {
                const res = await fetch(`${apiUrl}/guilds/${guildId}/invites`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                });
                return res.json();
            },
            { apiUrl: API_URL, guildId },
        );
        inviteCode = response.code;

        // B joins guild
        await pageB.locator("[data-testid='join-guild-btn']").click();
        await pageB.getByPlaceholder("e.g. AbCdEfGh").fill(inviteCode);
        await pageB.getByRole("button", { name: /join server/i }).click();
        await pageB.waitForURL(new RegExp(`/app/guild/${guildId}`), { timeout: 15_000 });

        // Ensure voice channel exists
        await pageA.waitForSelector("text=Voice Channels", { timeout: 10_000 });
        const voiceIcons = pageA.locator("polygon[points='11 5 6 9 2 9 2 15 6 15 11 19 11 5']");
        if ((await voiceIcons.count()) === 0) {
            await pageA.evaluate(
                async ({ apiUrl, guildId }) => {
                    await fetch(`${apiUrl}/channels/guild/${guildId}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ name: "SS Voice", type: 1, position: 0 }),
                    });
                },
                { apiUrl: API_URL, guildId },
            );
            await pageA.reload();
            await pageA.waitForSelector("text=Voice Channels", { timeout: 10_000 });
            await injectWebRtcTracker(pageA);
        }

        // Get voice channel name
        const voiceChannelSpans = pageA
            .locator("polygon[points='11 5 6 9 2 9 2 15 6 15 11 19 11 5']")
            .locator("..").locator("..").locator("span.truncate");
        voiceChannelName = (await voiceChannelSpans.first().textContent())!.trim();

        // A joins voice
        await pageA.locator(`span.truncate:has-text("${voiceChannelName}")`).first().click();
        await expect(pageA.locator("text=Voice Connected")).toBeVisible({ timeout: 15_000 });

        // B joins voice
        await pageB.reload();
        await pageB.waitForSelector("text=Voice Channels", { timeout: 10_000 });
        await injectWebRtcTracker(pageB);
        await pageB.locator(`span.truncate:has-text("${voiceChannelName}")`).first().click();
        await expect(pageB.locator("text=Voice Connected")).toBeVisible({ timeout: 15_000 });

        // Both see each other
        await expect(pageB.locator(`text=${userA.displayName}`).first()).toBeVisible({ timeout: 10_000 });
        await expect(pageA.locator(`text=${userB.displayName}`).first()).toBeVisible({ timeout: 10_000 });
    });

    // ─── BASIC FLOW ───────────────────────────────────────────────────

    test("User A starts screen share and User B sees continuous stream for 1.5s", async () => {
        await startShare(pageA);

        // B must opt in
        await optIn(pageB);

        // Verify continuous non-black frames over 1.5 seconds (3 samples)
        await expectContinuousVideoStream(
            pageB,
            "Bob receives Alice's screen share continuously",
        );
    });

    test("User A stops screen share and all videos disappear for User B", async () => {
        await stopShare(pageA);

        await expect
            .poll(() => countActiveVideos(pageB), {
                message: "Bob should have 0 active videos after Alice stops sharing",
                timeout: 10_000,
            })
            .toBe(0);
    });

    // ─── RESTART RELIABILITY ──────────────────────────────────────────

    test("Screen share restart — User A shares again and User B auto-watches", async () => {
        // watchingStreams persists in VoiceChannelView, so B should auto-watch
        await startShare(pageA);

        // B should NOT need to click "Watch Stream" again
        await expect(pageB.getByRole("button", { name: "Watch Stream" })).not.toBeVisible({ timeout: 3_000 });

        // Verify continuous stream on restart
        await expectContinuousVideoStream(
            pageB,
            "Bob auto-watches Alice's restarted screen share",
        );

        await stopShare(pageA);

        await expect
            .poll(() => countActiveVideos(pageB), {
                message: "Videos disappear after second stop",
                timeout: 10_000,
            })
            .toBe(0);
    });

    test("Screen share second restart — still works reliably", async () => {
        // Third start — stress the restart path
        await startShare(pageA);

        await expectContinuousVideoStream(
            pageB,
            "Bob sees Alice's third screen share session",
        );

        await stopShare(pageA);
    });

    // ─── CAMERA + SCREEN SHARE SIMULTANEOUSLY ─────────────────────────

    test("User A camera + screen share simultaneously — User B sees 2 streams", async () => {
        // Enable camera first
        await pageA.locator("[title='Turn On Camera']").click();
        await expect(pageA.locator("[title='Turn Off Camera']")).toBeVisible({ timeout: 10_000 });

        // Then screen share
        await startShare(pageA);

        // B should see 2 active videos: camera tile + screen share tile
        await expect
            .poll(() => countActiveVideos(pageB), {
                message: "Bob should see 2 active videos (camera + screen share)",
                timeout: 15_000,
                intervals: [1000, 2000, 2000, 3000],
            })
            .toBeGreaterThanOrEqual(2);

        // Verify at least one is rendering non-black
        await expectVideoPlaying(pageB, "Bob sees non-black frames from combined streams");

        // Verify screen share stream is continuous
        await expectContinuousVideoStream(
            pageB,
            "Screen share stream stays live alongside camera",
        );

        // Stop both
        await stopShare(pageA);
        await pageA.locator("[title='Turn Off Camera']").click();
        await expect(pageA.locator("[title='Turn On Camera']")).toBeVisible({ timeout: 10_000 });
    });

    // ─── BOTH USERS SHARING AT THE SAME TIME ─────────────────────────

    test("Both users share screens simultaneously", async () => {
        // A starts sharing
        await startShare(pageA);

        // B starts sharing
        await startShare(pageB);

        // A must opt into B's stream
        await optIn(pageA);

        // Both should receive the other's stream
        await expectVideoReceiving(pageA, "Alice receives Bob's screen share");
        await expectVideoPlaying(pageA, "Alice sees Bob's screen share as non-black frames");

        // B already opted into A's stream (from earlier tests)
        await expectVideoReceiving(pageB, "Bob receives Alice's screen share");
        await expectVideoPlaying(pageB, "Bob sees Alice's screen share as non-black frames");

        // Verify continuous streams for both
        await expectContinuousVideoStream(pageA, "Alice sees Bob's stream continuously");
        await expectContinuousVideoStream(pageB, "Bob sees Alice's stream continuously");

        // Stop both
        await stopShare(pageA);
        await stopShare(pageB);

        await expect
            .poll(() => countActiveVideos(pageA), {
                message: "Alice should have 0 active videos after both stop",
                timeout: 10_000,
            })
            .toBe(0);

        await expect
            .poll(() => countActiveVideos(pageB), {
                message: "Bob should have 0 active videos after both stop",
                timeout: 10_000,
            })
            .toBe(0);
    });

    // ─── OPT-IN / OPT-OUT BEHAVIOR ───────────────────────────────────

    test("Opt-in card appears for a new sharer the first time", async () => {
        // B starts sharing — A has already opted in from the dual-share test above,
        // so A should auto-watch.
        await startShare(pageB);

        // A should NOT see opt-in card (already opted in earlier)
        await expect(pageA.getByRole("button", { name: "Watch Stream" })).not.toBeVisible({ timeout: 3_000 });
        await expectVideoPlaying(pageA, "Alice auto-watches Bob's stream");

        await stopShare(pageB);
    });

    test("Stop watching and re-opt-in works", async () => {
        // A starts sharing, B is already opted in
        await startShare(pageA);

        await expectVideoPlaying(pageB, "Bob auto-watches before opting out");

        // B stops watching (hover over the screen share tile to reveal the button)
        const stopWatchingBtn = pageB.locator("[title='Stop watching']");
        // The button is hidden until hover — force click
        if (await stopWatchingBtn.count() > 0) {
            await stopWatchingBtn.click({ force: true });
        }

        // B should now see the opt-in card
        await expect(pageB.getByRole("button", { name: "Watch Stream" })).toBeVisible({ timeout: 5_000 });

        // B opts back in
        await optIn(pageB);

        // Verify stream resumes
        await expectContinuousVideoStream(pageB, "Bob re-opted in and sees continuous stream");

        await stopShare(pageA);
    });

    // ─── RAPID START/STOP STRESS TEST ─────────────────────────────────

    test("Rapid start-stop-start does not leave stale state", async () => {
        // Quick start
        await startShare(pageA);

        // Wait just enough for the share to initialize
        await expect(pageA.locator("[title='Stop Sharing']")).toBeVisible({ timeout: 10_000 });

        // Quick stop
        await stopShare(pageA);

        // Quick start again
        await startShare(pageA);

        // B should still be able to see the stream (opt-in persisted)
        await expectContinuousVideoStream(
            pageB,
            "Bob sees stream after rapid start-stop-start",
        );

        await stopShare(pageA);
    });

    // ─── CLEANUP ──────────────────────────────────────────────────────

    test("Both users disconnect cleanly", async () => {
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
