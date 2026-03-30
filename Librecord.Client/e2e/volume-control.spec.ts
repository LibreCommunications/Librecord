import { test, expect } from "@playwright/test";
import {
    makeUser,
    registerUser,
    injectWebRtcTracker,
    expectAudioReceiving,
    API_URL,
    type TestUser,
} from "./helpers";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * Per-user volume control e2e tests:
 *
 *   1. Register two users (Alice & Bob)
 *   2. Alice creates a guild, Bob joins via invite
 *   3. Both join a voice channel
 *   4. Verify audio flows between them
 *   5. Bob right-clicks Alice's tile → volume popup appears
 *   6. Adjust slider → verify stored volume changes
 *   7. Set volume to 0% → verify muted
 *   8. Reset to 100% → verify unity
 *   9. Set volume to 200% → verify boost
 *  10. Verify volume persists after closing/reopening popup
 *  11. Verify own tile does NOT show volume popup
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

/** Get all stored user volumes from localStorage */
async function getStoredVolumes(page: Page): Promise<Record<string, number>> {
    return page.evaluate(() => {
        try {
            return JSON.parse(localStorage.getItem("librecord:userVolumes") ?? "{}");
        } catch { return {}; }
    });
}

/** Get the single stored volume value (assumes only one user's volume is set) */
async function getFirstStoredVolume(page: Page): Promise<number | null> {
    const vols = await getStoredVolumes(page);
    const values = Object.values(vols);
    return values.length > 0 ? values[0] : null;
}

test.describe.serial("Per-user volume control in voice channel", () => {
    // ─── SETUP: Register users, create guild, join voice ─────────────

    test("Register User A (Alice)", async ({ browser }) => {
        userA = makeUser("alice");
        ({ context: ctxA, page: pageA } = await registerUser(browser, userA));
        await expect(pageA).toHaveURL(/\/app/);
        await injectWebRtcTracker(pageA);
    });

    test("Register User B (Bob)", async ({ browser }) => {
        userB = makeUser("bob");
        ({ context: ctxB, page: pageB } = await registerUser(browser, userB));
        await expect(pageB).toHaveURL(/\/app/);
        await injectWebRtcTracker(pageB);
    });

    test("Alice creates a guild", async () => {
        await pageA.locator("[data-testid='create-guild-btn']").click();
        await pageA.getByPlaceholder("My Guild").fill("Volume Test Guild");
        await pageA.getByRole("button", { name: /create guild/i }).click();
        await pageA.waitForURL(/\/app\/guild\//, { timeout: 10_000 });

        const match = pageA.url().match(/\/app\/guild\/([^/]+)/);
        expect(match).toBeTruthy();
        guildId = match![1];
    });

    test("Alice creates an invite", async () => {
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
        expect(response.code).toBeTruthy();
        inviteCode = response.code;
    });

    test("Bob joins the guild", async () => {
        await pageB.locator("[data-testid='join-guild-btn']").click();
        await pageB.getByPlaceholder("e.g. AbCdEfGh").fill(inviteCode);
        await pageB.getByRole("button", { name: /join guild/i }).click();
        await pageB.waitForURL(new RegExp(`/app/guild/${guildId}`), { timeout: 15_000 });
    });

    test("Ensure voice channel exists", async () => {
        voiceChannelName = "E2E Voice";

        // Create voice channel via API
        await pageA.evaluate(
            async ({ apiUrl, guildId, name }) => {
                await fetch(`${apiUrl}/channels/guild/${guildId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ name, type: 1, position: 0 }),
                });
            },
            { apiUrl: API_URL, guildId, name: voiceChannelName },
        );

        await pageA.reload();
        await pageA.waitForLoadState("networkidle");
        await injectWebRtcTracker(pageA);
        await expect(pageA.locator(`text=${voiceChannelName}`).first()).toBeVisible({ timeout: 10_000 });

        await pageB.reload();
        await pageB.waitForLoadState("networkidle");
        await injectWebRtcTracker(pageB);
        await expect(pageB.locator(`text=${voiceChannelName}`).first()).toBeVisible({ timeout: 10_000 });
    });

    test("Alice joins voice", async () => {
        await pageA.locator(`span.truncate:has-text("${voiceChannelName}")`).first().click();
        await expect(pageA.locator("text=Voice Connected")).toBeVisible({ timeout: 15_000 });
    });

    test("Bob joins voice and both see each other", async () => {
        await pageB.locator(`span.truncate:has-text("${voiceChannelName}")`).first().click();
        await expect(pageB.locator("text=Voice Connected")).toBeVisible({ timeout: 15_000 });
        await expect(pageB.locator(`text=${userA.displayName}`).first()).toBeVisible({ timeout: 10_000 });
        await expect(pageA.locator(`text=${userB.displayName}`).first()).toBeVisible({ timeout: 10_000 });
    });

    test("Audio flows between users", async () => {
        await expectAudioReceiving(pageB, "Bob receives Alice's audio");
        await expectAudioReceiving(pageA, "Alice receives Bob's audio");
    });

    // ─── VOLUME CONTROL TESTS ────────────────────────────────────────

    test("Right-clicking Alice's tile on Bob's page opens volume popup", async () => {
        // Target Alice's participant tile (aspect-video div containing her truncated name)
        // Use the first name word to handle truncation
        const firstName = userA.displayName.split(" ")[0];
        const aliceTile = pageB.locator(`.aspect-video:has-text("${firstName}")`).first();
        await expect(aliceTile).toBeVisible({ timeout: 5_000 });
        await aliceTile.click({ button: "right" });

        const popup = pageB.locator(".fixed.z-\\[999\\]");
        await expect(popup).toBeVisible({ timeout: 5_000 });
    });

    test("Volume slider is at 100% by default", async () => {
        const popup = pageB.locator(".fixed.z-\\[999\\]");
        await expect(popup.locator("span.font-mono:has-text('100%')")).toBeVisible();
    });

    test("Dragging slider to far left sets volume to ~0%", async () => {
        const popup = pageB.locator(".fixed.z-\\[999\\]");
        const track = popup.locator(".group\\/slider");

        const box = await track.boundingBox();
        expect(box).toBeTruthy();
        // Click at the very left edge
        await pageB.mouse.click(box!.x + 2, box!.y + box!.height / 2);

        // Should show 0% or close to it
        await expect
            .poll(async () => {
                const text = await popup.locator("span.font-mono").textContent();
                return parseInt(text ?? "999");
            }, { timeout: 3_000 })
            .toBeLessThanOrEqual(2);

        // localStorage should reflect it
        const vol = await getFirstStoredVolume(pageB);
        expect(vol).not.toBeNull();
        expect(vol!).toBeLessThanOrEqual(2);
    });

    test("Reset to 100% button appears and works", async () => {
        const popup = pageB.locator(".fixed.z-\\[999\\]");
        const resetBtn = popup.locator("text=Reset to 100%");
        await expect(resetBtn).toBeVisible();
        await resetBtn.click();

        await expect(popup.locator("span.font-mono:has-text('100%')")).toBeVisible({ timeout: 3_000 });

        const vol = await getFirstStoredVolume(pageB);
        expect(vol).toBe(100);
    });

    test("Dragging slider to far right sets volume to ~200%", async () => {
        const popup = pageB.locator(".fixed.z-\\[999\\]");
        const track = popup.locator(".group\\/slider");

        const box = await track.boundingBox();
        expect(box).toBeTruthy();
        // Click at the very right edge
        await pageB.mouse.click(box!.x + box!.width - 2, box!.y + box!.height / 2);

        await expect
            .poll(async () => {
                const text = await popup.locator("span.font-mono").textContent();
                return parseInt(text ?? "0");
            }, { timeout: 3_000 })
            .toBeGreaterThanOrEqual(198);

        const vol = await getFirstStoredVolume(pageB);
        expect(vol).not.toBeNull();
        expect(vol!).toBeGreaterThanOrEqual(198);
    });

    test("Mute toggle via speaker icon", async () => {
        const popup = pageB.locator(".fixed.z-\\[999\\]");

        // Click speaker icon to mute (volume was ~200, so title is "Mute")
        await popup.locator("button[title='Mute']").click();
        await expect(popup.locator("span.font-mono:has-text('0%')")).toBeVisible({ timeout: 3_000 });

        const volMuted = await getFirstStoredVolume(pageB);
        expect(volMuted).toBe(0);

        // Click again to unmute (goes back to 100%)
        await popup.locator("button[title='Unmute']").click();
        await expect(popup.locator("span.font-mono:has-text('100%')")).toBeVisible({ timeout: 3_000 });

        const volUnmuted = await getFirstStoredVolume(pageB);
        expect(volUnmuted).toBe(100);
    });

    test("Volume persists after closing and reopening popup", async () => {
        const popup = pageB.locator(".fixed.z-\\[999\\]");

        // Set to 150% via slider drag
        const track = popup.locator(".group\\/slider");
        const box = await track.boundingBox();
        expect(box).toBeTruthy();
        // Click at 75% of the track width (150/200 = 75%)
        await pageB.mouse.click(box!.x + box!.width * 0.75, box!.y + box!.height / 2);

        const setVol = await getFirstStoredVolume(pageB);
        expect(setVol).not.toBeNull();
        expect(setVol!).toBeGreaterThanOrEqual(140);
        expect(setVol!).toBeLessThanOrEqual(160);

        // Close popup
        await pageB.mouse.click(10, 10);
        await expect(popup).not.toBeVisible({ timeout: 3_000 });

        // Reopen
        const firstName = userA.displayName.split(" ")[0];
        const aliceTile = pageB.locator(`.aspect-video:has-text("${firstName}")`).first();
        await aliceTile.click({ button: "right" });
        await expect(popup).toBeVisible({ timeout: 5_000 });

        // Should show the persisted value
        const text = await popup.locator("span.font-mono").textContent();
        const pct = parseInt(text!);
        expect(pct).toBeGreaterThanOrEqual(140);
        expect(pct).toBeLessThanOrEqual(160);

        // Reset for clean state
        await popup.locator("text=Reset to 100%").click();
        await pageB.mouse.click(10, 10);
    });

    test("Audio still flows after volume adjustments", async () => {
        await expectAudioReceiving(pageB, "Bob still receives Alice's audio after volume changes");
    });

    // ─── SELF-TILE SHOULD NOT SHOW VOLUME POPUP ──────────────────────

    test("Right-clicking own tile does NOT open volume popup", async () => {
        const bobFirstName = userB.displayName.split(" ")[0];
        const bobTile = pageB.locator(`.aspect-video:has-text("${bobFirstName}")`).first();
        await bobTile.click({ button: "right" });

        // Volume popup should NOT appear
        const popup = pageB.locator(".fixed.z-\\[999\\]");
        await expect(popup).not.toBeVisible({ timeout: 2_000 });
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
