import { test, expect } from "@playwright/test";
import { makeUser, registerUser, BASE, API_URL, type TestUser } from "./helpers";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * Tests for cancel friend request (#21) and close DM (#39):
 *
 * CANCEL FRIEND REQUEST:
 *   - Cancel button appears on outgoing requests
 *   - Clicking cancel removes the request from sender's list
 *   - Cancelled request disappears from receiver's incoming list in realtime
 *   - Cancel API returns success
 *
 * CLOSE DM:
 *   - X button appears on 1-on-1 DMs on hover
 *   - Clicking X removes the DM from sidebar
 *   - DM reappears when new message arrives
 */

let userA: TestUser;
let userB: TestUser;
let ctxA: BrowserContext;
let ctxB: BrowserContext;
let pageA: Page;
let pageB: Page;

test.describe.serial("Cancel friend request (#21)", () => {
    test("Register two users", async ({ browser }) => {
        userA = makeUser("zara");
        userB = makeUser("axel");
        ({ context: ctxA, page: pageA } = await registerUser(browser, userA));
        ({ context: ctxB, page: pageB } = await registerUser(browser, userB));
    });

    test("A sends friend request to B", async () => {
        const sent = await pageA.evaluate(
            async ({ apiUrl, username }) => {
                const res = await fetch(`${apiUrl}/friends/request`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ username }),
                });
                return res.ok;
            },
            { apiUrl: API_URL, username: userB.username },
        );
        expect(sent).toBe(true);
    });

    test("Both navigate to friends list", async () => {
        await pageA.goto(`${BASE}/app/dm/friends/list`);
        await pageA.waitForLoadState("networkidle");
        await expect(pageA.locator("h1")).toBeVisible({ timeout: 10_000 });

        await pageB.goto(`${BASE}/app/dm/friends/list`);
        await pageB.waitForLoadState("networkidle");
        await expect(pageB.locator("h1")).toBeVisible({ timeout: 10_000 });
    });

    test("A sees outgoing request with cancel button", async () => {
        // A should see the outgoing section
        await expect(
            pageA.locator("text=Outgoing Friend Request"),
        ).toBeVisible({ timeout: 10_000 });

        // A should see B's name
        await expect(
            pageA.locator(`text=${userB.displayName}`),
        ).toBeVisible({ timeout: 5_000 });

        // Cancel button should be visible (X icon with title "Cancel request")
        await expect(
            pageA.locator("[title='Cancel request']"),
        ).toBeVisible({ timeout: 5_000 });
    });

    test("B sees incoming request", async () => {
        await expect(
            pageB.locator("text=Incoming Friend Request"),
        ).toBeVisible({ timeout: 10_000 });

        await expect(
            pageB.locator(`text=${userA.displayName}`),
        ).toBeVisible({ timeout: 5_000 });
    });

    test("A cancels the request — disappears from A's list", async () => {
        await pageA.locator("[title='Cancel request']").click();

        // Toast should appear
        await expect(
            pageA.locator("text=Friend request cancelled"),
        ).toBeVisible({ timeout: 5_000 });

        // Outgoing section should disappear (no more pending requests)
        await expect(
            pageA.locator("text=Outgoing Friend Request"),
        ).not.toBeVisible({ timeout: 10_000 });
    });

    test("Cancelled request disappears from B's incoming list in realtime", async () => {
        // B should see the incoming request disappear WITHOUT refresh
        await expect(
            pageB.locator("text=Incoming Friend Request"),
        ).not.toBeVisible({ timeout: 15_000 });

        // A's name should no longer be in B's pending section
        await expect(
            pageB.locator(`text=${userA.displayName}`).first(),
        ).not.toBeVisible({ timeout: 5_000 });
    });

    test.afterAll(async () => {
        await ctxA?.close();
        await ctxB?.close();
    });
});

// =====================================================================
// CLOSE DM (#39)
// =====================================================================

let dmUserA: TestUser;
let dmUserB: TestUser;
let dmCtxA: BrowserContext;
let dmCtxB: BrowserContext;
let dmPageA: Page;
let dmPageB: Page;
let dmChannelId: string;

test.describe.serial("Close DM conversation (#39)", () => {
    test("Register users and become friends", async ({ browser }) => {
        dmUserA = makeUser("beau");
        dmUserB = makeUser("cara");
        ({ context: dmCtxA, page: dmPageA } = await registerUser(browser, dmUserA));
        ({ context: dmCtxB, page: dmPageB } = await registerUser(browser, dmUserB));

        // Friend request + accept via API
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

    test("A starts a DM with B", async () => {
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

        // Navigate A to DM sidebar
        await dmPageA.goto(`${BASE}/app/dm`);
        await dmPageA.waitForLoadState("networkidle");
    });

    test("A sees the DM in sidebar", async () => {
        await expect(
            dmPageA.locator(`text=${dmUserB.displayName}`).first(),
        ).toBeVisible({ timeout: 10_000 });
    });

    test("X button appears on hover for 1-on-1 DM", async () => {
        const dmRow = dmPageA.locator(`a[href="/app/dm/${dmChannelId}"]`).locator("..");
        await dmRow.hover();

        await expect(
            dmRow.locator("[title='Close conversation']"),
        ).toBeVisible({ timeout: 3_000 });
    });

    test("Clicking X removes DM from sidebar", async () => {
        const dmRow = dmPageA.locator(`a[href="/app/dm/${dmChannelId}"]`).locator("..");
        await dmRow.hover();
        await dmRow.locator("[title='Close conversation']").click();

        // DM should disappear from sidebar
        await expect(
            dmPageA.locator(`a[href="/app/dm/${dmChannelId}"]`),
        ).not.toBeVisible({ timeout: 5_000 });
    });

    test("DM reappears when new message arrives", async () => {
        // B sends a message to the DM
        await dmPageB.goto(`${BASE}/app/dm/${dmChannelId}`);
        await dmPageB.waitForLoadState("networkidle");
        await expect(dmPageB.locator(`textarea[placeholder*="Message"]`)).toBeVisible({ timeout: 10_000 });

        const msg = `Reappear test ${Date.now()}`;
        await dmPageB.locator(`textarea[placeholder*="Message"]`).fill(msg);
        await dmPageB.locator(`textarea[placeholder*="Message"]`).press("Enter");
        await expect(dmPageB.locator(`[data-testid='message-content']:has-text("${msg}")`)).toBeVisible({ timeout: 5_000 });

        // A should see the DM reappear via the ping event refreshing the sidebar
        // (the dm:message:ping triggers unread badge which shows the DM)
        await expect(
            dmPageA.locator(`a[href="/app/dm/${dmChannelId}"]`),
        ).toBeVisible({ timeout: 15_000 });
    });

    test.afterAll(async () => {
        await dmCtxA?.close();
        await dmCtxB?.close();
    });
});
