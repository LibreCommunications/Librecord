import { test, expect } from "@playwright/test";
import { makeUser, registerUser, waitForRealtime, BASE, API_URL, type TestUser } from "./helpers";
import type { BrowserContext, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

/**
 * Tests for miscellaneous bug fixes:
 *
 * #31 — Scroll position after media upload
 * #32 — Group DM appears for all members without refresh
 * #34 — Reaction popup z-index above input area
 */

// =====================================================================
// #32 — GROUP DM VISIBILITY
// =====================================================================

let grpUserA: TestUser;
let grpUserB: TestUser;
let grpUserC: TestUser;
let grpCtxA: BrowserContext;
let grpCtxB: BrowserContext;
let grpCtxC: BrowserContext;
let grpPageA: Page;
let grpPageB: Page;
let grpPageC: Page;

test.describe.serial("Group DM appears for all members (#32)", () => {
    test("Register three users and make friends", async ({ browser }) => {
        grpUserA = makeUser("dale");
        grpUserB = makeUser("emma");
        grpUserC = makeUser("finn");
        ({ context: grpCtxA, page: grpPageA } = await registerUser(browser, grpUserA));
        ({ context: grpCtxB, page: grpPageB } = await registerUser(browser, grpUserB));
        ({ context: grpCtxC, page: grpPageC } = await registerUser(browser, grpUserC));

        // A sends requests to B and C
        for (const target of [grpUserB, grpUserC]) {
            await grpPageA.evaluate(
                async ({ apiUrl, username }) => {
                    await fetch(`${apiUrl}/friends/request`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ username }),
                    });
                },
                { apiUrl: API_URL, username: target.username },
            );
        }

        // B and C accept
        for (const page of [grpPageB, grpPageC]) {
            const requests = await page.evaluate(
                async ({ apiUrl }) => {
                    const res = await fetch(`${apiUrl}/friends/requests`, { credentials: "include" });
                    return res.json();
                },
                { apiUrl: API_URL },
            );
            for (const req of requests.incoming) {
                await page.evaluate(
                    async ({ apiUrl, requesterId }) => {
                        await fetch(`${apiUrl}/friends/accept/${requesterId}`, {
                            method: "POST",
                            credentials: "include",
                        });
                    },
                    { apiUrl: API_URL, requesterId: req.otherUserId },
                );
            }
        }
    });

    test("B and C navigate to DM sidebar", async () => {
        await grpPageB.goto(`${BASE}/app/dm`);
        await grpPageB.waitForLoadState("networkidle");

        await grpPageC.goto(`${BASE}/app/dm`);
        await grpPageC.waitForLoadState("networkidle");
    });

    test("A creates group DM — B and C see it without refresh", async () => {
        // Get friend IDs
        const friends = await grpPageA.evaluate(
            async ({ apiUrl }) => {
                const res = await fetch(`${apiUrl}/friends/list`, { credentials: "include" });
                return res.json();
            },
            { apiUrl: API_URL },
        );

        const memberIds = friends.map((f: { otherUserId: string }) => f.otherUserId);
        expect(memberIds.length).toBe(2);

        // Create group DM
        const result = await grpPageA.evaluate(
            async ({ apiUrl, memberIds }) => {
                const res = await fetch(`${apiUrl}/dms/group`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ memberIds }),
                });
                return res.json();
            },
            { apiUrl: API_URL, memberIds },
        );

        expect(result.channelId).toBeTruthy();
        const groupChannelId = result.channelId;

        // B should see the group DM appear in sidebar WITHOUT refresh
        await expect(
            grpPageB.locator(`a[href="/app/dm/${groupChannelId}"]`),
        ).toBeVisible({ timeout: 15_000 });

        // C should also see it WITHOUT refresh
        await expect(
            grpPageC.locator(`a[href="/app/dm/${groupChannelId}"]`),
        ).toBeVisible({ timeout: 15_000 });
    });

    test("A's own sidebar shows the group DM", async () => {
        await grpPageA.goto(`${BASE}/app/dm`);
        await grpPageA.waitForLoadState("networkidle");

        // A should see B and C's names (group DM shows member names)
        await expect(
            grpPageA.locator(`text=${grpUserB.displayName}`).first(),
        ).toBeVisible({ timeout: 10_000 });
    });

    test.afterAll(async () => {
        await grpCtxA?.close();
        await grpCtxB?.close();
        await grpCtxC?.close();
    });
});

// =====================================================================
// #32 — 1-on-1 DM SENDER SIDEBAR UPDATE
// =====================================================================

let dmSenderA: TestUser;
let dmSenderB: TestUser;
let dmSenderCtxA: BrowserContext;
let dmSenderCtxB: BrowserContext;
let dmSenderPageA: Page;
let dmSenderPageB: Page;

test.describe.serial("New 1-on-1 DM appears in sender's sidebar (#32)", () => {
    test("Register and become friends", async ({ browser }) => {
        dmSenderA = makeUser("gina");
        dmSenderB = makeUser("hiro");
        ({ context: dmSenderCtxA, page: dmSenderPageA } = await registerUser(browser, dmSenderA));
        ({ context: dmSenderCtxB, page: dmSenderPageB } = await registerUser(browser, dmSenderB));

        await dmSenderPageA.evaluate(
            async ({ apiUrl, username }) => {
                await fetch(`${apiUrl}/friends/request`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ username }),
                });
            },
            { apiUrl: API_URL, username: dmSenderB.username },
        );

        const requests = await dmSenderPageB.evaluate(
            async ({ apiUrl }) => {
                const res = await fetch(`${apiUrl}/friends/requests`, { credentials: "include" });
                return res.json();
            },
            { apiUrl: API_URL },
        );

        await dmSenderPageB.evaluate(
            async ({ apiUrl, requesterId }) => {
                await fetch(`${apiUrl}/friends/accept/${requesterId}`, {
                    method: "POST",
                    credentials: "include",
                });
            },
            { apiUrl: API_URL, requesterId: requests.incoming[0].otherUserId },
        );
    });

    test("A starts DM from friends page — DM appears in A's sidebar", async () => {
        // A goes to DM page (sidebar visible)
        await dmSenderPageA.goto(`${BASE}/app/dm/friends/list`);
        await dmSenderPageA.waitForLoadState("networkidle");

        // No DM with B yet
        await expect(
            dmSenderPageA.locator(`text=${dmSenderB.displayName}`).first(),
        ).not.toBeVisible({ timeout: 3_000 });

        // A starts DM via API
        const friends = await dmSenderPageA.evaluate(
            async ({ apiUrl }) => {
                const res = await fetch(`${apiUrl}/friends/list`, { credentials: "include" });
                return res.json();
            },
            { apiUrl: API_URL },
        );
        const bUserId = friends.find((f: { otherUsername: string }) => f.otherUsername === dmSenderB.username)?.otherUserId;

        await dmSenderPageA.evaluate(
            async ({ apiUrl, targetUserId }) => {
                await fetch(`${apiUrl}/dms/start/${targetUserId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ content: "" }),
                });
            },
            { apiUrl: API_URL, targetUserId: bUserId },
        );

        // A's sidebar should now show B's name WITHOUT refresh
        await expect(
            dmSenderPageA.locator(`text=${dmSenderB.displayName}`).first(),
        ).toBeVisible({ timeout: 15_000 });
    });

    test.afterAll(async () => {
        await dmSenderCtxA?.close();
        await dmSenderCtxB?.close();
    });
});

// =====================================================================
// #31 — SCROLL POSITION AFTER MEDIA
// =====================================================================

let scrollUserA: TestUser;
let scrollCtxA: BrowserContext;
let scrollPageA: Page;
let scrollGuildId: string;
let scrollChannelId: string;

test.describe.serial("Scroll position after file upload (#31)", () => {
    test("Register user and create guild + channel", async ({ browser }) => {
        scrollUserA = makeUser("iris");
        ({ context: scrollCtxA, page: scrollPageA } = await registerUser(browser, scrollUserA));

        await scrollPageA.locator("[data-testid='create-guild-btn']").click();
        await scrollPageA.getByPlaceholder("My Guild").fill("Scroll Test Guild");
        await scrollPageA.getByRole("button", { name: /create guild/i }).click();
        await scrollPageA.waitForURL(/\/app\/guild\//, { timeout: 10_000 });
        scrollGuildId = scrollPageA.url().match(/\/app\/guild\/([^/]+)/)![1];

        const channel = await scrollPageA.evaluate(
            async ({ apiUrl, guildId }) => {
                const res = await fetch(`${apiUrl}/channels/guild/${guildId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ name: "scroll-test", type: 0, position: 0 }),
                });
                return res.json();
            },
            { apiUrl: API_URL, guildId: scrollGuildId },
        );
        scrollChannelId = channel.id;

        await scrollPageA.goto(`${BASE}/app/guild/${scrollGuildId}/${scrollChannelId}`);
        await scrollPageA.waitForLoadState("networkidle");
        await waitForRealtime(scrollPageA);
        await expect(scrollPageA.locator(`textarea[placeholder*="Message #"]`)).toBeVisible({ timeout: 10_000 });
    });

    test("Send multiple text messages to create scroll history", async () => {
        const input = scrollPageA.locator(`textarea[placeholder*="Message #"]`);
        for (let i = 0; i < 10; i++) {
            await input.fill(`Filler message ${i + 1} - ${Date.now()}`);
            await input.press("Enter");
            await scrollPageA.waitForTimeout(100);
        }
        // Wait for last message to appear
        await expect(
            scrollPageA.locator(`[data-testid='message-content']:has-text("Filler message 10")`),
        ).toBeVisible({ timeout: 5_000 });
    });

    test("Upload file — page scrolls to show it", async () => {
        // Create a test file
        const tmpFile = path.join("/tmp", `scroll-test-${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, "Scroll position test file content");

        // Attach file
        const fileInput = scrollPageA.locator('input[type="file"]');
        await fileInput.setInputFiles(tmpFile);

        // Send with text
        const input = scrollPageA.locator(`textarea[placeholder*="Message #"]`);
        await input.fill("Message with file attached");
        await input.press("Enter");

        // Wait for the message to appear (with attachment)
        await expect(
            scrollPageA.locator(`[data-testid='message-content']:has-text("Message with file attached")`),
        ).toBeVisible({ timeout: 30_000 });

        // The message should be visible (scrolled into view)
        const msgEl = scrollPageA.locator(`[data-testid='message-content']:has-text("Message with file attached")`);
        await expect(msgEl).toBeInViewport({ timeout: 5_000 });

        fs.unlinkSync(tmpFile);
    });

    test.afterAll(async () => {
        await scrollCtxA?.close();
    });
});

// =====================================================================
// #34 — REACTION POPUP Z-INDEX
// =====================================================================

let zUserA: TestUser;
let zCtxA: BrowserContext;
let zPageA: Page;
let zGuildId: string;
let zChannelId: string;

test.describe.serial("Reaction popup renders above input (#34)", () => {
    test("Register users and create guild + channel", async ({ browser }) => {
        zUserA = makeUser("jade");
        ({ context: zCtxA, page: zPageA } = await registerUser(browser, zUserA));

        await zPageA.locator("[data-testid='create-guild-btn']").click();
        await zPageA.getByPlaceholder("My Guild").fill("ZIndex Test Guild");
        await zPageA.getByRole("button", { name: /create guild/i }).click();
        await zPageA.waitForURL(/\/app\/guild\//, { timeout: 10_000 });
        zGuildId = zPageA.url().match(/\/app\/guild\/([^/]+)/)![1];

        const channel = await zPageA.evaluate(
            async ({ apiUrl, guildId }) => {
                const res = await fetch(`${apiUrl}/channels/guild/${guildId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ name: "zindex-test", type: 0, position: 0 }),
                });
                return res.json();
            },
            { apiUrl: API_URL, guildId: zGuildId },
        );
        zChannelId = channel.id;

        await zPageA.goto(`${BASE}/app/guild/${zGuildId}/${zChannelId}`);
        await zPageA.waitForLoadState("networkidle");
        await waitForRealtime(zPageA);
        await expect(zPageA.locator(`textarea[placeholder*="Message #"]`)).toBeVisible({ timeout: 10_000 });
    });

    test("Send a message and add a reaction", async () => {
        const input = zPageA.locator(`textarea[placeholder*="Message #"]`);
        const msg = `Z-index test ${Date.now()}`;
        await input.fill(msg);
        await input.press("Enter");
        await expect(zPageA.locator(`[data-testid='message-content']:has-text("${msg}")`)).toBeVisible({ timeout: 5_000 });

        // Hover and add reaction via More menu
        const msgRow = zPageA.locator(`.group:has([data-testid='message-content']:has-text("${msg}"))`);
        await msgRow.hover();
        const moreBtn = msgRow.locator("[title='More']");
        await expect(moreBtn).toBeVisible({ timeout: 3_000 });
        await moreBtn.click();

        // Emoji picker should be visible
        const emojiPicker = zPageA.locator(".z-\\[100\\]");
        await expect(emojiPicker).toBeVisible({ timeout: 3_000 });
    });

    test("Emoji picker renders above the message input area", async () => {
        // The picker should have z-index 100 and be positioned above
        const picker = zPageA.locator(".z-\\[100\\]");
        const inputArea = zPageA.locator(`textarea[placeholder*="Message #"]`);

        if (await picker.isVisible()) {
            const pickerBox = await picker.boundingBox();
            const inputBox = await inputArea.boundingBox();

            if (pickerBox && inputBox) {
                // Picker's bottom should be above the input's top
                expect(pickerBox.y + pickerBox.height).toBeLessThanOrEqual(inputBox.y + 10);
            }
        }
    });

    test.afterAll(async () => {
        await zCtxA?.close();
    });
});
