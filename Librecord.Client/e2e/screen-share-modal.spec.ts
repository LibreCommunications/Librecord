import { test, expect } from "@playwright/test";
import {
    makeUser,
    registerUser,
    injectWebRtcTracker,
    collectWebRtcStats,
    API_URL,
    type TestUser,
} from "./helpers";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * Screen Share Modal e2e tests:
 *
 * Verifies the modal UI (resolution, FPS, audio options) and that
 * selected settings are reflected in the outbound WebRTC track.
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

/** Click "Share Screen" button, configure the modal, and click "Go Live". */
async function startScreenShareWithOptions(
    page: Page,
    opts: { resolution?: string; fps?: string; audio?: boolean },
) {
    await page.locator("[title='Share Screen']").click();
    await expect(page.getByText("Screen Share")).toBeVisible({ timeout: 5_000 });

    // Select resolution if specified
    if (opts.resolution) {
        await page
            .locator("[data-testid='screenshare-modal'] button, .modal-card-animated button")
            .filter({ hasText: opts.resolution })
            .first()
            .click();
    }

    // Select FPS if specified
    if (opts.fps) {
        await page
            .locator("[data-testid='screenshare-modal'] button, .modal-card-animated button")
            .filter({ hasText: opts.fps })
            .first()
            .click();
    }

    // Toggle audio if specified (default is on)
    if (opts.audio === false) {
        await page.getByText("Share Audio").click();
    }

    await page.getByRole("button", { name: "Go Live" }).click();
    await expect(page.locator("[title='Stop Sharing']")).toBeVisible({ timeout: 10_000 });
}

async function stopScreenShare(page: Page) {
    await page.locator("[title='Stop Sharing']").click();
    await expect(page.locator("[title='Share Screen']")).toBeVisible({ timeout: 10_000 });
}

/**
 * Wait for outbound screen share video stats to appear, then return
 * the highest-resolution outbound video stream stats.
 */
async function waitForOutboundScreenStats(page: Page) {
    let stats: Awaited<ReturnType<typeof collectWebRtcStats>> = [];

    await expect
        .poll(
            async () => {
                stats = await collectWebRtcStats(page);
                for (const pc of stats) {
                    for (const s of pc.streams) {
                        if (
                            s.kind === "video" &&
                            s.direction === "outbound" &&
                            (s.frameWidth ?? 0) > 0
                        ) {
                            return true;
                        }
                    }
                }
                return false;
            },
            { message: "Waiting for outbound screen share video stats", timeout: 15_000 },
        )
        .toBe(true);

    // Find the highest-resolution outbound video stream
    let best: (typeof stats)[0]["streams"][0] | null = null;
    for (const pc of stats) {
        for (const s of pc.streams) {
            if (s.kind === "video" && s.direction === "outbound" && (s.frameWidth ?? 0) > 0) {
                if (!best || (s.frameWidth ?? 0) > (best.frameWidth ?? 0)) {
                    best = s;
                }
            }
        }
    }
    return best!;
}

test.describe.serial("Screen Share Modal — settings & WebRTC verification", () => {
    // ─── SETUP: Register users, create guild, join voice ──────────────

    test("Register User A", async ({ browser }) => {
        userA = makeUser("scrA");
        ({ context: ctxA, page: pageA } = await registerUser(browser, userA));
        await expect(pageA).toHaveURL(/\/app/);
        await injectWebRtcTracker(pageA);
    });

    test("Register User B", async ({ browser }) => {
        userB = makeUser("scrB");
        ({ context: ctxB, page: pageB } = await registerUser(browser, userB));
        await expect(pageB).toHaveURL(/\/app/);
        await injectWebRtcTracker(pageB);
    });

    test("Create guild and invite User B", async () => {
        await pageA.locator("[data-testid='create-guild-btn']").click();
        await pageA.getByPlaceholder("My Guild").fill("ScreenShare Test");
        await pageA.getByRole("button", { name: /create guild/i }).click();
        await pageA.waitForURL(/\/app\/guild\//, { timeout: 10_000 });

        guildId = pageA.url().match(/\/app\/guild\/([^/]+)/)![1];

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

        await pageB.locator("[data-testid='join-guild-btn']").click();
        await pageB.getByPlaceholder("e.g. AbCdEfGh").fill(inviteCode);
        await pageB.getByRole("button", { name: /join server/i }).click();
        await pageB.waitForURL(new RegExp(`/app/guild/${guildId}`), { timeout: 15_000 });
    });

    test("Ensure voice channel and join both users", async () => {
        await pageA.waitForSelector("text=Voice Channels", { timeout: 10_000 });

        const voiceIcons = pageA.locator("polygon[points='11 5 6 9 2 9 2 15 6 15 11 19 11 5']");
        if ((await voiceIcons.count()) === 0) {
            await pageA.evaluate(
                async ({ apiUrl, guildId }) => {
                    await fetch(`${apiUrl}/channels/guild/${guildId}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ name: "ScreenShare VC", type: 1, position: 0 }),
                    });
                },
                { apiUrl: API_URL, guildId },
            );
            await pageA.reload();
            await pageA.waitForSelector("text=Voice Channels", { timeout: 10_000 });
            await injectWebRtcTracker(pageA);
        }

        const voiceChannelSpans = pageA
            .locator("polygon[points='11 5 6 9 2 9 2 15 6 15 11 19 11 5']")
            .locator("..").locator("..").locator("span.truncate");
        voiceChannelName = (await voiceChannelSpans.first().textContent())!.trim();

        // User A joins
        await pageA.locator(`span.truncate:has-text("${voiceChannelName}")`).first().click();
        await expect(pageA.locator("text=Voice Connected")).toBeVisible({ timeout: 15_000 });

        // User B joins
        await pageB.reload();
        await pageB.waitForSelector("text=Voice Channels", { timeout: 10_000 });
        await injectWebRtcTracker(pageB);
        await pageB.locator(`span.truncate:has-text("${voiceChannelName}")`).first().click();
        await expect(pageB.locator("text=Voice Connected")).toBeVisible({ timeout: 15_000 });

        // Both see each other
        await expect(pageB.locator(`text=${userA.displayName}`).first()).toBeVisible({ timeout: 10_000 });
        await expect(pageA.locator(`text=${userB.displayName}`).first()).toBeVisible({ timeout: 10_000 });
    });

    // ─── MODAL UI TESTS ──────────────────────────────────────────────

    test("Modal opens with default settings (Source res, Source FPS, audio on)", async () => {
        await pageA.locator("[title='Share Screen']").click();
        const modal = pageA.locator(".modal-card-animated");
        await expect(modal).toBeVisible({ timeout: 5_000 });

        // "Source" resolution should be the default (1080p is default resolution)
        // Check that 1080p button has the selected border color
        const selectedRes = modal.locator("button").filter({ hasText: "1080p" }).first();
        await expect(selectedRes).toHaveClass(/border-\[#5865F2\]/);

        // "Source" FPS should be selected by default.
        // Use .last() because the resolution "Source" button comes first in the DOM.
        const selectedFps = modal.locator("button").filter({ hasText: /^Source$/ }).last();
        await expect(selectedFps).toHaveClass(/border-\[#5865F2\]/);

        // Audio toggle should be on (blue bg)
        const toggle = modal.locator(".rounded-full.bg-\\[\\#5865F2\\]");
        await expect(toggle).toBeVisible();

        // Cancel without starting
        await pageA.getByText("Cancel").click();
        await expect(modal).not.toBeVisible();
        // Button should still say "Share Screen" (not started)
        await expect(pageA.locator("[title='Share Screen']")).toBeVisible();
    });

    test("Modal cancel via backdrop click", async () => {
        await pageA.locator("[title='Share Screen']").click();
        await expect(pageA.locator(".modal-card-animated")).toBeVisible({ timeout: 5_000 });

        // Click overlay (outside modal card)
        await pageA.locator(".modal-overlay-animated").click({ position: { x: 10, y: 10 } });
        await expect(pageA.locator(".modal-card-animated")).not.toBeVisible();
        await expect(pageA.locator("[title='Share Screen']")).toBeVisible();
    });

    test("Resolution buttons toggle selection", async () => {
        await pageA.locator("[title='Share Screen']").click();
        const modal = pageA.locator(".modal-card-animated");
        await expect(modal).toBeVisible({ timeout: 5_000 });

        // Click 720p
        await modal.locator("button").filter({ hasText: "720p" }).first().click();
        await expect(modal.locator("button").filter({ hasText: "720p" }).first()).toHaveClass(/border-\[#5865F2\]/);
        // 1080p should no longer be selected
        await expect(modal.locator("button").filter({ hasText: "1080p" }).first()).not.toHaveClass(/border-\[#5865F2\]/);

        // Click 1440p
        await modal.locator("button").filter({ hasText: "1440p" }).first().click();
        await expect(modal.locator("button").filter({ hasText: "1440p" }).first()).toHaveClass(/border-\[#5865F2\]/);
        await expect(modal.locator("button").filter({ hasText: "720p" }).first()).not.toHaveClass(/border-\[#5865F2\]/);

        // Click Source
        await modal.locator("button").filter({ hasText: "Source" }).first().click();
        await expect(modal.locator("button").filter({ hasText: "Source" }).first()).toHaveClass(/border-\[#5865F2\]/);

        await pageA.getByText("Cancel").click();
    });

    test("FPS buttons toggle selection", async () => {
        await pageA.locator("[title='Share Screen']").click();
        const modal = pageA.locator(".modal-card-animated");
        await expect(modal).toBeVisible({ timeout: 5_000 });

        // Click 15 FPS
        await modal.locator("button").filter({ hasText: "15 FPS" }).click();
        await expect(modal.locator("button").filter({ hasText: "15 FPS" })).toHaveClass(/border-\[#5865F2\]/);

        // Click 60 FPS
        await modal.locator("button").filter({ hasText: "60 FPS" }).click();
        await expect(modal.locator("button").filter({ hasText: "60 FPS" })).toHaveClass(/border-\[#5865F2\]/);
        await expect(modal.locator("button").filter({ hasText: "15 FPS" })).not.toHaveClass(/border-\[#5865F2\]/);

        // Click Source FPS
        await modal.locator("button").filter({ hasText: /^Source$/ }).last().click();
        await expect(modal.locator("button").filter({ hasText: /^Source$/ }).last()).toHaveClass(/border-\[#5865F2\]/);

        await pageA.getByText("Cancel").click();
    });

    test("Audio toggle switches off and on", async () => {
        await pageA.locator("[title='Share Screen']").click();
        const modal = pageA.locator(".modal-card-animated");
        await expect(modal).toBeVisible({ timeout: 5_000 });

        // Initially on — blue toggle
        await expect(modal.locator(".rounded-full.bg-\\[\\#5865F2\\]")).toBeVisible();

        // Click to toggle off
        await pageA.getByText("Share Audio").click();
        // Should now show gray toggle
        await expect(modal.locator(".rounded-full.bg-\\[\\#4e5058\\]")).toBeVisible();

        // Click to toggle back on
        await pageA.getByText("Share Audio").click();
        await expect(modal.locator(".rounded-full.bg-\\[\\#5865F2\\]")).toBeVisible();

        await pageA.getByText("Cancel").click();
    });

    // ─── WEBRTC VERIFICATION TESTS ───────────────────────────────────

    test("720p screen share produces ≤720p outbound video", async () => {
        await startScreenShareWithOptions(pageA, { resolution: "720p", fps: "30 FPS" });

        const outbound = await waitForOutboundScreenStats(pageA);
        // Chromium's fake screen may not produce exactly 1280x720, but it should
        // be capped at or below 720p
        expect(outbound.frameHeight).toBeLessThanOrEqual(720 + 10); // small tolerance
        expect(outbound.frameWidth).toBeLessThanOrEqual(1280 + 10);
        expect(outbound.frameWidth).toBeGreaterThan(0);

        await stopScreenShare(pageA);
    });

    test("1080p screen share produces ≤1080p outbound video", async () => {
        await startScreenShareWithOptions(pageA, { resolution: "1080p", fps: "30 FPS" });

        const outbound = await waitForOutboundScreenStats(pageA);
        expect(outbound.frameHeight).toBeLessThanOrEqual(1080 + 10);
        expect(outbound.frameWidth).toBeLessThanOrEqual(1920 + 10);
        expect(outbound.frameWidth).toBeGreaterThan(0);

        await stopScreenShare(pageA);
    });

    test("Source resolution screen share sends frames without capping", async () => {
        await startScreenShareWithOptions(pageA, { resolution: "Source" });

        const outbound = await waitForOutboundScreenStats(pageA);
        // Just verify it's sending something — source resolution depends on the display
        expect(outbound.frameWidth).toBeGreaterThan(0);
        expect(outbound.frameHeight).toBeGreaterThan(0);

        await stopScreenShare(pageA);
    });

    test("Source FPS screen share sends frames", async () => {
        // Use Source for both resolution and FPS — most permissive
        await startScreenShareWithOptions(pageA, { resolution: "Source", fps: "Source" });

        const outbound = await waitForOutboundScreenStats(pageA);
        expect(outbound.frameWidth).toBeGreaterThan(0);
        expect(outbound.frameHeight).toBeGreaterThan(0);

        await stopScreenShare(pageA);
    });

    test("Stop sharing button directly stops without showing modal", async () => {
        await startScreenShareWithOptions(pageA, {});

        // Clicking stop should NOT show the modal — it should stop immediately
        await pageA.locator("[title='Stop Sharing']").click();
        await expect(pageA.locator("[title='Share Screen']")).toBeVisible({ timeout: 5_000 });
        // Modal should not have appeared
        await expect(pageA.locator(".modal-card-animated")).not.toBeVisible();
    });

    // ─── CLEANUP ─────────────────────────────────────────────────────

    test("Both users disconnect", async () => {
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
