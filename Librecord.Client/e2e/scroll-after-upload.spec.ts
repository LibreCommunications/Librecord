import { test, expect } from "@playwright/test";
import { makeUser, registerUser, waitForRealtime, BASE, API_URL, type TestUser } from "./helpers";
import type { BrowserContext, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

/**
 * E2E tests for scroll position after sending messages with attachments.
 *
 * #31 — DM scroll resets to wrong position when media is sent
 * #58 — Same issue in guild channels
 *
 * After sending a message with an image attachment, the scroll should
 * remain at the bottom once the image finishes loading, not stop at
 * where the text-only message ended.
 */

// Generate a test PNG image file
function createTestImage(filePath: string): void {
    // Minimal valid 1x1 red PNG
    const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
    );
    fs.writeFileSync(filePath, png);
}

/** Helper: check if the scroll container is at (or very near) the bottom */
async function isScrolledToBottom(page: Page, containerSelector: string): Promise<boolean> {
    return page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const threshold = 30;
        return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    }, containerSelector);
}

/** Helper: send several text messages to push older content out of the viewport */
async function fillWithMessages(page: Page, inputSelector: string, count: number): Promise<void> {
    const input = page.locator(inputSelector);
    for (let i = 0; i < count; i++) {
        await input.fill(`Filler message ${i + 1} — ${Date.now()}`);
        await input.press("Enter");
        await page.waitForTimeout(200);
    }
    // Wait for last message to render
    await page.waitForTimeout(500);
}

// The scroll container is the flex-1 overflow-y-auto div inside the message area
const SCROLL_CONTAINER = ".flex-1.overflow-y-auto.dark-scrollbar";

// =====================================================================
// DM — Scroll after image upload (#31)
// =====================================================================

let dmUserA: TestUser;
let dmUserB: TestUser;
let dmCtxA: BrowserContext;
let dmCtxB: BrowserContext;
let dmPageA: Page;
let dmPageB: Page;
let dmChannelId: string;

test.describe.serial("DM scroll position after image upload (#31)", () => {
    test("Setup: register users, become friends, start DM", async ({ browser }) => {
        dmUserA = makeUser("scrollA");
        dmUserB = makeUser("scrollB");

        [{ context: dmCtxA, page: dmPageA }, { context: dmCtxB, page: dmPageB }] = await Promise.all([
            registerUser(browser, dmUserA),
            registerUser(browser, dmUserB),
        ]);

        // A sends friend request to B
        await dmPageA.evaluate(
            async ({ apiUrl, username }) => {
                await fetch(`${apiUrl}/friends/request`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ username }),
                });
            },
            { apiUrl: API_URL, username: dmUserB.username },
        );

        // B accepts
        const requests = await dmPageB.evaluate(
            async ({ apiUrl }) => {
                const res = await fetch(`${apiUrl}/friends/requests`, { credentials: "include" });
                return res.json();
            },
            { apiUrl: API_URL },
        );
        const requesterId = requests.incoming[0].otherUserId;
        await dmPageB.evaluate(
            async ({ apiUrl, requesterId }) => {
                await fetch(`${apiUrl}/friends/accept/${requesterId}`, {
                    method: "POST",
                    credentials: "include",
                });
            },
            { apiUrl: API_URL, requesterId },
        );

        // A starts DM
        const friends = await dmPageA.evaluate(
            async ({ apiUrl }) => {
                const res = await fetch(`${apiUrl}/friends/list`, { credentials: "include" });
                return res.json();
            },
            { apiUrl: API_URL },
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const friend = friends.find((f: any) => f.otherUsername === dmUserB.username);
        const result = await dmPageA.evaluate(
            async ({ apiUrl, targetUserId }) => {
                const res = await fetch(`${apiUrl}/dms/start/${targetUserId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ content: "" }),
                });
                return res.json();
            },
            { apiUrl: API_URL, targetUserId: friend.otherUserId },
        );
        dmChannelId = result.channelId;

        // Both navigate to the DM
        await dmPageA.goto(`${BASE}/app/dm/${dmChannelId}`);
        await dmPageA.waitForLoadState("networkidle");
        await waitForRealtime(dmPageA);
        await expect(dmPageA.locator(`textarea[placeholder*="Message"]`)).toBeVisible({ timeout: 10_000 });

        await dmPageB.goto(`${BASE}/app/dm/${dmChannelId}`);
        await dmPageB.waitForLoadState("networkidle");
        await waitForRealtime(dmPageB);
        await expect(dmPageB.locator(`textarea[placeholder*="Message"]`)).toBeVisible({ timeout: 10_000 });
    });

    test("Scroll stays at bottom after sending an image in DM", async () => {
        // Fill enough messages so the container is scrollable
        await fillWithMessages(dmPageA, `textarea[placeholder*="Message"]`, 15);

        // Confirm we're at the bottom before uploading
        await expect.poll(
            () => isScrolledToBottom(dmPageA, SCROLL_CONTAINER),
            { message: "Should be at bottom before upload", timeout: 5_000 },
        ).toBe(true);

        // Create a test image
        const tmpImage = path.join("/tmp", `test-scroll-dm-${Date.now()}.png`);
        createTestImage(tmpImage);

        // Attach the image
        const fileInput = dmPageA.locator('input[type="file"]');
        await fileInput.setInputFiles(tmpImage);

        // Send message with the image
        const input = dmPageA.locator(`textarea[placeholder*="Message"]`);
        await input.fill("DM image scroll test");
        await input.press("Enter");

        // Wait for the message with attachment to appear (image element visible)
        await expect(
            dmPageA.locator(`[data-testid='message-content']:has-text("DM image scroll test")`),
        ).toBeVisible({ timeout: 30_000 });

        // Poll until scroll settles at bottom (image load + re-scroll may take a moment)
        await expect.poll(
            () => isScrolledToBottom(dmPageA, SCROLL_CONTAINER),
            { message: "Should be at bottom after image upload", timeout: 10_000 },
        ).toBe(true);

        fs.unlinkSync(tmpImage);
    });

    test("Receiver also sees scroll at bottom after image arrives in DM", async () => {
        // Bob should have received the image message via real-time
        await expect(
            dmPageB.locator(`[data-testid='message-content']:has-text("DM image scroll test")`),
        ).toBeVisible({ timeout: 10_000 });

        // Poll until scroll settles at bottom
        await expect.poll(
            () => isScrolledToBottom(dmPageB, SCROLL_CONTAINER),
            { message: "Receiver should be at bottom after image arrives", timeout: 10_000 },
        ).toBe(true);
    });

    test.afterAll(async () => {
        await dmCtxA?.close();
        await dmCtxB?.close();
    });
});

// =====================================================================
// Guild — Scroll after image upload (#58)
// =====================================================================

let guildUserA: TestUser;
let guildCtxA: BrowserContext;
let guildPageA: Page;
let guildId: string;
let guildChannelId: string;

test.describe.serial("Guild channel scroll position after image upload (#58)", () => {
    test("Setup: register user, create guild + channel", async ({ browser }) => {
        guildUserA = makeUser("gscroll");
        ({ context: guildCtxA, page: guildPageA } = await registerUser(browser, guildUserA));

        // Create guild
        await guildPageA.locator("[data-testid='create-guild-btn']").click();
        await guildPageA.getByPlaceholder("My Guild").fill("Scroll Test Guild");
        await guildPageA.getByRole("button", { name: /create guild/i }).click();
        await guildPageA.waitForURL(/\/app\/guild\//, { timeout: 10_000 });
        guildId = guildPageA.url().match(/\/app\/guild\/([^/]+)/)![1];

        // Create channel via API
        const channel = await guildPageA.evaluate(
            async ({ apiUrl, guildId }) => {
                const res = await fetch(`${apiUrl}/channels/guild/${guildId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ name: "scroll-test", type: 0, position: 0 }),
                });
                return res.json();
            },
            { apiUrl: API_URL, guildId },
        );
        guildChannelId = channel.id;

        await guildPageA.goto(`${BASE}/app/guild/${guildId}/${guildChannelId}`);
        await guildPageA.waitForLoadState("networkidle");
        await waitForRealtime(guildPageA);
        await expect(guildPageA.locator(`textarea[placeholder*="Message #"]`)).toBeVisible({ timeout: 10_000 });
    });

    test("Scroll stays at bottom after sending an image in guild channel", async () => {
        // Fill enough messages so the container is scrollable
        await fillWithMessages(guildPageA, `textarea[placeholder*="Message #"]`, 15);

        // Confirm at bottom
        await expect.poll(
            () => isScrolledToBottom(guildPageA, SCROLL_CONTAINER),
            { message: "Should be at bottom before upload", timeout: 5_000 },
        ).toBe(true);

        // Create a test image
        const tmpImage = path.join("/tmp", `test-scroll-guild-${Date.now()}.png`);
        createTestImage(tmpImage);

        // Attach + send
        const fileInput = guildPageA.locator('input[type="file"]');
        await fileInput.setInputFiles(tmpImage);

        const input = guildPageA.locator(`textarea[placeholder*="Message #"]`);
        await input.fill("Guild image scroll test");
        await input.press("Enter");

        // Wait for message to appear
        await expect(
            guildPageA.locator(`[data-testid='message-content']:has-text("Guild image scroll test")`),
        ).toBeVisible({ timeout: 30_000 });

        // Poll until scroll settles at bottom
        await expect.poll(
            () => isScrolledToBottom(guildPageA, SCROLL_CONTAINER),
            { message: "Should be at bottom after guild image upload", timeout: 10_000 },
        ).toBe(true);

        fs.unlinkSync(tmpImage);
    });

    test("Multiple consecutive image uploads keep scroll at bottom in guild", async () => {
        for (let i = 1; i <= 3; i++) {
            const tmpImage = path.join("/tmp", `test-scroll-guild-multi-${i}-${Date.now()}.png`);
            createTestImage(tmpImage);

            const fileInput = guildPageA.locator('input[type="file"]');
            await fileInput.setInputFiles(tmpImage);

            const input = guildPageA.locator(`textarea[placeholder*="Message #"]`);
            await input.fill(`Multi upload ${i}`);
            await input.press("Enter");

            await expect(
                guildPageA.locator(`[data-testid='message-content']:has-text("Multi upload ${i}")`),
            ).toBeVisible({ timeout: 30_000 });

            fs.unlinkSync(tmpImage);
        }

        // Poll until scroll settles at bottom after all uploads
        await expect.poll(
            () => isScrolledToBottom(guildPageA, SCROLL_CONTAINER),
            { message: "Should be at bottom after multiple uploads", timeout: 10_000 },
        ).toBe(true);
    });

    test.afterAll(async () => {
        await guildCtxA?.close();
    });
});
