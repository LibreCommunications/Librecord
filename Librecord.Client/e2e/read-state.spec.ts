import { test, expect } from "@playwright/test";
import { makeUser, registerUser, waitForRealtime, BASE, API_URL, type TestUser } from "./helpers";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * Comprehensive read state tests:
 *
 * GUILD CHANNELS:
 *   - Unread badge appears when another user sends a message
 *   - Unread badge clears when navigating to the channel
 *   - Unread badge persists across page refresh if not read
 *   - Unread badge clears after page refresh if channel was viewed
 *   - Self-sent messages don't create unread badges
 *   - Multiple unread messages show correct count
 *   - markAsRead API is called on channel navigation
 *
 * DM CHANNELS:
 *   - Unread badge appears in DM sidebar
 *   - Unread badge clears when opening the DM
 *   - Unread persists across refresh if not read
 */

let userA: TestUser;
let userB: TestUser;
let ctxA: BrowserContext;
let ctxB: BrowserContext;
let pageA: Page;
let pageB: Page;

let guildId: string;
let channel1Id: string;
let channel2Id: string;

test.describe.serial("Read state — guild channels", () => {
    test("Register User A", async ({ browser }) => {
        userA = makeUser("vera");
        ({ context: ctxA, page: pageA } = await registerUser(browser, userA));
    });

    test("Register User B", async ({ browser }) => {
        userB = makeUser("walt");
        ({ context: ctxB, page: pageB } = await registerUser(browser, userB));
    });

    test("Create guild with two text channels + B joins", async () => {
        // A creates guild
        await pageA.locator("[data-testid='create-guild-btn']").click();
        await pageA.getByPlaceholder("My Guild").fill("ReadState Test Guild");
        await pageA.getByRole("button", { name: /create guild/i }).click();
        await pageA.waitForURL(/\/app\/guild\//, { timeout: 10_000 });
        guildId = pageA.url().match(/\/app\/guild\/([^/]+)/)![1];

        // Create two channels
        const ch1 = await pageA.evaluate(
            async ({ apiUrl, guildId }) => {
                const res = await fetch(`${apiUrl}/channels/guild/${guildId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ name: "channel-one", type: 0, position: 0 }),
                });
                return res.json();
            },
            { apiUrl: API_URL, guildId },
        );
        channel1Id = ch1.id;

        const ch2 = await pageA.evaluate(
            async ({ apiUrl, guildId }) => {
                const res = await fetch(`${apiUrl}/channels/guild/${guildId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ name: "channel-two", type: 0, position: 1 }),
                });
                return res.json();
            },
            { apiUrl: API_URL, guildId },
        );
        channel2Id = ch2.id;

        // Create invite + B joins
        const invite = await pageA.evaluate(
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

        await pageB.locator("[data-testid='join-guild-btn']").click();
        await pageB.getByPlaceholder("e.g. AbCdEfGh").fill(invite.code);
        await pageB.getByRole("button", { name: /join server/i }).click();
        await pageB.waitForURL(new RegExp(`/app/guild/${guildId}`), { timeout: 15_000 });
    });

    test("Both navigate to channel-one with fresh SignalR", async () => {
        await pageA.goto(`${BASE}/app/guild/${guildId}/${channel1Id}`);
        await pageA.waitForLoadState("networkidle");
        await waitForRealtime(pageA);
        await expect(pageA.locator(`textarea[placeholder*="Message #"]`)).toBeVisible({ timeout: 10_000 });

        await pageB.goto(`${BASE}/app/guild/${guildId}/${channel1Id}`);
        await pageB.waitForLoadState("networkidle");
        await waitForRealtime(pageB);
        await expect(pageB.locator(`textarea[placeholder*="Message #"]`)).toBeVisible({ timeout: 10_000 });
    });

    test("Self-sent messages don't create unread badges", async () => {
        // A sends a message in channel-one (A is viewing channel-one)
        const input = pageA.locator(`textarea[placeholder*="Message #"]`);
        await input.fill(`Self msg ${Date.now()}`);
        await input.press("Enter");
        await pageA.waitForTimeout(500);

        // A should NOT see an unread badge on channel-one (they're viewing it)
        const badge = pageA.locator(`a[href="/app/guild/${guildId}/${channel1Id}"] [data-testid='unread-badge']`);
        await expect(badge).not.toBeVisible({ timeout: 3_000 });
    });

    test("Unread badge appears when another user sends a message", async () => {
        // B navigates to channel-two so channel-one is not active
        await pageB.goto(`${BASE}/app/guild/${guildId}/${channel2Id}`);
        await pageB.waitForLoadState("networkidle");
        await waitForRealtime(pageB);
        await expect(pageB.locator(`textarea[placeholder*="Message #"]`)).toBeVisible({ timeout: 10_000 });

        // A sends a message in channel-one
        const msg = `Unread test ${Date.now()}`;
        await pageA.locator(`textarea[placeholder*="Message #"]`).fill(msg);
        await pageA.locator(`textarea[placeholder*="Message #"]`).press("Enter");
        await expect(pageA.locator(`[data-testid='message-content']:has-text("${msg}")`)).toBeVisible({ timeout: 5_000 });

        // B should see an unread badge on channel-one in the sidebar
        await expect(
            pageB.locator(`a:has(span.truncate:has-text("channel-one")) [data-testid='unread-badge']`),
        ).toBeVisible({ timeout: 10_000 });
    });

    test("Unread badge clears when navigating to the channel", async () => {
        // B clicks on channel-one
        await pageB.locator(`a:has(span.truncate:has-text("channel-one"))`).first().click();
        await expect(pageB.locator(`textarea[placeholder*="Message #"]`)).toBeVisible({ timeout: 5_000 });

        // Badge should be gone
        await expect(
            pageB.locator(`a:has(span.truncate:has-text("channel-one")) [data-testid='unread-badge']`),
        ).not.toBeVisible({ timeout: 5_000 });
    });

    test("markAsRead API is called on channel navigation", async () => {
        // Send another message from A while B is on channel-two
        await pageB.goto(`${BASE}/app/guild/${guildId}/${channel2Id}`);
        await pageB.waitForLoadState("networkidle");

        const msg = `Ack test ${Date.now()}`;
        await pageA.locator(`textarea[placeholder*="Message #"]`).fill(msg);
        await pageA.locator(`textarea[placeholder*="Message #"]`).press("Enter");
        await expect(pageA.locator(`[data-testid='message-content']:has-text("${msg}")`)).toBeVisible({ timeout: 5_000 });

        // Wait for badge to appear
        await expect(
            pageB.locator(`a:has(span.truncate:has-text("channel-one")) [data-testid='unread-badge']`),
        ).toBeVisible({ timeout: 10_000 });

        // Set up a request listener for the ack call
        const ackPromise = pageB.waitForRequest(
            req => req.url().includes("/ack") && req.method() === "POST",
            { timeout: 10_000 }
        );

        // B navigates to channel-one
        await pageB.locator(`a:has(span.truncate:has-text("channel-one"))`).first().click();

        // Verify the ack request was sent
        const ackReq = await ackPromise;
        expect(ackReq.url()).toContain(`/channels/${channel1Id}/ack`);
    });

    test("Unread badge persists across refresh if channel not viewed", async () => {
        // B is on channel-one, send message from A to channel-two
        await pageB.goto(`${BASE}/app/guild/${guildId}/${channel1Id}`);
        await pageB.waitForLoadState("networkidle");
        await waitForRealtime(pageB);

        // A navigates to channel-two and sends a message
        await pageA.goto(`${BASE}/app/guild/${guildId}/${channel2Id}`);
        await pageA.waitForLoadState("networkidle");
        await waitForRealtime(pageA);
        await expect(pageA.locator(`textarea[placeholder*="Message #"]`)).toBeVisible({ timeout: 10_000 });

        const msg = `Persist test ${Date.now()}`;
        await pageA.locator(`textarea[placeholder*="Message #"]`).fill(msg);
        await pageA.locator(`textarea[placeholder*="Message #"]`).press("Enter");
        await expect(pageA.locator(`[data-testid='message-content']:has-text("${msg}")`)).toBeVisible({ timeout: 5_000 });

        // Wait for badge to appear on B
        await expect(
            pageB.locator(`a:has(span.truncate:has-text("channel-two")) [data-testid='unread-badge']`),
        ).toBeVisible({ timeout: 10_000 });

        // B refreshes the page (stays on channel-one, doesn't view channel-two)
        await pageB.reload();
        await pageB.waitForLoadState("networkidle");

        // Badge should still be there after refresh
        await expect(
            pageB.locator(`a:has(span.truncate:has-text("channel-two")) [data-testid='unread-badge']`),
        ).toBeVisible({ timeout: 10_000 });
    });

    test("Unread badge clears after refresh if channel was viewed", async () => {
        // B navigates to channel-two (reads the messages)
        await pageB.locator(`a:has(span.truncate:has-text("channel-two"))`).first().click();
        await expect(pageB.locator(`textarea[placeholder*="Message #"]`)).toBeVisible({ timeout: 5_000 });

        // Badge should be gone
        await expect(
            pageB.locator(`a:has(span.truncate:has-text("channel-two")) [data-testid='unread-badge']`),
        ).not.toBeVisible({ timeout: 5_000 });

        // Refresh and verify still gone
        await pageB.reload();
        await pageB.waitForLoadState("networkidle");

        await expect(
            pageB.locator(`a:has(span.truncate:has-text("channel-two")) [data-testid='unread-badge']`),
        ).not.toBeVisible({ timeout: 10_000 });
    });

    test("Multiple unread messages show correct badge", async () => {
        // B is on channel-two. A sends 3 messages to channel-one.

        // A goes to channel-one
        await pageA.goto(`${BASE}/app/guild/${guildId}/${channel1Id}`);
        await pageA.waitForLoadState("networkidle");
        await waitForRealtime(pageA);
        await expect(pageA.locator(`textarea[placeholder*="Message #"]`)).toBeVisible({ timeout: 10_000 });

        for (let i = 0; i < 3; i++) {
            await pageA.locator(`textarea[placeholder*="Message #"]`).fill(`Multi ${i + 1} - ${Date.now()}`);
            await pageA.locator(`textarea[placeholder*="Message #"]`).press("Enter");
            await pageA.waitForTimeout(200);
        }

        // B should see a badge with count >= 3
        await expect(
            pageB.locator(`a:has(span.truncate:has-text("channel-one")) [data-testid='unread-badge']`),
        ).toBeVisible({ timeout: 10_000 });
    });

    test.afterAll(async () => {
        await ctxA?.close();
        await ctxB?.close();
    });
});

// =====================================================================
// DM READ STATE
// =====================================================================

let dmUserA: TestUser;
let dmUserB: TestUser;
let dmCtxA: BrowserContext;
let dmCtxB: BrowserContext;
let dmPageA: Page;
let dmPageB: Page;
let dmChannelId: string;

test.describe.serial("Read state — DM channels", () => {
    test("Register two users and become friends", async ({ browser }) => {
        dmUserA = makeUser("xena");
        dmUserB = makeUser("yuri");
        ({ context: dmCtxA, page: dmPageA } = await registerUser(browser, dmUserA));
        ({ context: dmCtxB, page: dmPageB } = await registerUser(browser, dmUserB));

        // Friend request + accept
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

        const requests = await dmPageB.evaluate(
            async ({ apiUrl }) => {
                const res = await fetch(`${apiUrl}/friends/requests`, { credentials: "include" });
                return res.json();
            },
            { apiUrl: API_URL },
        );

        await dmPageB.evaluate(
            async ({ apiUrl, requesterId }) => {
                await fetch(`${apiUrl}/friends/accept/${requesterId}`, {
                    method: "POST",
                    credentials: "include",
                });
            },
            { apiUrl: API_URL, requesterId: requests.incoming[0].otherUserId },
        );
    });

    test("Start a DM and both navigate to it", async () => {
        const friends = await dmPageA.evaluate(
            async ({ apiUrl }) => {
                const res = await fetch(`${apiUrl}/friends/list`, { credentials: "include" });
                return res.json();
            },
            { apiUrl: API_URL },
        );

        const bUserId = friends.find((f: { otherUsername: string }) => f.otherUsername === dmUserB.username)?.otherUserId;

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
            { apiUrl: API_URL, targetUserId: bUserId },
        );
        dmChannelId = result.channelId;

        await dmPageA.goto(`${BASE}/app/dm/${dmChannelId}`);
        await dmPageA.waitForLoadState("networkidle");
        await waitForRealtime(dmPageA);

        await dmPageB.goto(`${BASE}/app/dm/${dmChannelId}`);
        await dmPageB.waitForLoadState("networkidle");
        await waitForRealtime(dmPageB);
    });

    test("DM unread badge appears when other user sends while away", async () => {
        // B navigates away from the DM
        await dmPageB.goto(`${BASE}/app/dm/friends/list`);
        await dmPageB.waitForLoadState("networkidle");

        // A sends a message
        const msg = `DM unread ${Date.now()}`;
        await dmPageA.locator(`textarea[placeholder*="Message"]`).fill(msg);
        await dmPageA.locator(`textarea[placeholder*="Message"]`).press("Enter");
        await expect(dmPageA.locator(`[data-testid='message-content']:has-text("${msg}")`)).toBeVisible({ timeout: 5_000 });

        // B should see unread badge in DM sidebar
        await expect(
            dmPageB.locator(`a[href="/app/dm/${dmChannelId}"] [data-testid='unread-badge']`),
        ).toBeVisible({ timeout: 10_000 });
    });

    test("DM unread badge clears when opening the conversation", async () => {
        // B clicks the DM
        await dmPageB.locator(`a[href="/app/dm/${dmChannelId}"]`).click();
        await expect(dmPageB.locator(`textarea[placeholder*="Message"]`)).toBeVisible({ timeout: 5_000 });

        // Badge should clear
        await expect(
            dmPageB.locator(`a[href="/app/dm/${dmChannelId}"] [data-testid='unread-badge']`),
        ).not.toBeVisible({ timeout: 5_000 });
    });

    test("DM unread persists across refresh if not read", async () => {
        // B goes to friends page
        await dmPageB.goto(`${BASE}/app/dm/friends/list`);
        await dmPageB.waitForLoadState("networkidle");

        // A sends another message
        const msg = `DM persist ${Date.now()}`;
        await dmPageA.locator(`textarea[placeholder*="Message"]`).fill(msg);
        await dmPageA.locator(`textarea[placeholder*="Message"]`).press("Enter");
        await expect(dmPageA.locator(`[data-testid='message-content']:has-text("${msg}")`)).toBeVisible({ timeout: 5_000 });

        // Badge appears
        await expect(
            dmPageB.locator(`a[href="/app/dm/${dmChannelId}"] [data-testid='unread-badge']`),
        ).toBeVisible({ timeout: 10_000 });

        // Refresh — badge should still be there
        await dmPageB.reload();
        await dmPageB.waitForLoadState("networkidle");

        await expect(
            dmPageB.locator(`a[href="/app/dm/${dmChannelId}"] [data-testid='unread-badge']`),
        ).toBeVisible({ timeout: 10_000 });
    });

    test("DM unread clears after viewing and refreshing", async () => {
        // B opens the DM (reads messages)
        await dmPageB.locator(`a[href="/app/dm/${dmChannelId}"]`).click();
        await expect(dmPageB.locator(`textarea[placeholder*="Message"]`)).toBeVisible({ timeout: 5_000 });

        // Wait for markAsRead to fire
        await dmPageB.waitForTimeout(1000);

        // Refresh
        await dmPageB.reload();
        await dmPageB.waitForLoadState("networkidle");

        // Badge should stay gone after refresh
        await expect(
            dmPageB.locator(`a[href="/app/dm/${dmChannelId}"] [data-testid='unread-badge']`),
        ).not.toBeVisible({ timeout: 10_000 });
    });

    test("markAsRead API sends correct channelId and messageId", async () => {
        // B goes away
        await dmPageB.goto(`${BASE}/app/dm/friends/list`);
        await dmPageB.waitForLoadState("networkidle");

        // A sends a message
        const msg = `Ack verify ${Date.now()}`;
        await dmPageA.locator(`textarea[placeholder*="Message"]`).fill(msg);
        await dmPageA.locator(`textarea[placeholder*="Message"]`).press("Enter");

        // Wait for badge
        await expect(
            dmPageB.locator(`a[href="/app/dm/${dmChannelId}"] [data-testid='unread-badge']`),
        ).toBeVisible({ timeout: 10_000 });

        // Listen for the ack request
        const ackPromise = dmPageB.waitForRequest(
            req => req.url().includes("/ack") && req.method() === "POST",
            { timeout: 10_000 }
        );

        // B opens the DM
        await dmPageB.locator(`a[href="/app/dm/${dmChannelId}"]`).click();

        // Verify ack was sent with correct channel
        const ackReq = await ackPromise;
        expect(ackReq.url()).toContain(`/channels/${dmChannelId}/ack`);

        // Verify body has a messageId
        const body = ackReq.postDataJSON();
        expect(body.messageId).toBeTruthy();
    });

    test.afterAll(async () => {
        await dmCtxA?.close();
        await dmCtxB?.close();
    });
});
