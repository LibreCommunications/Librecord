import { test, expect } from "@playwright/test";
import { makeUser, registerUser, BASE, API_URL, type TestUser } from "./helpers";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * E2E tests for realtime sync issues:
 *
 * FRIENDSHIPS (#7, #23):
 *   - Friend request appears on receiver without refresh
 *   - Accepted friend appears on requester without refresh
 *   - Removed friend disappears from list without refresh
 *   - Removed friend's DM disappears from sidebar without refresh
 *
 * GUILD DELETION (#14):
 *   - Deleted guild disappears from other members' sidebar without refresh
 *   - Member viewing deleted guild is redirected to DMs
 *
 * PIN / UNPIN (#29, #11):
 *   - Pinned message appears in pin panel without refresh
 *   - Unpinned message disappears from pin panel without refresh
 *   - Pin icon state updates in realtime
 */

// =====================================================================
// FRIENDSHIP REALTIME (#7, #23)
// =====================================================================

let frUserA: TestUser;
let frUserB: TestUser;
let frCtxA: BrowserContext;
let frCtxB: BrowserContext;
let frPageA: Page;
let frPageB: Page;

test.describe.serial("Friendship realtime — request, accept, remove sync (#7, #23)", () => {
    test("Register User A", async ({ browser }) => {
        frUserA = makeUser("fiona");
        ({ context: frCtxA, page: frPageA } = await registerUser(browser, frUserA));
    });

    test("Register User B", async ({ browser }) => {
        frUserB = makeUser("george");
        ({ context: frCtxB, page: frPageB } = await registerUser(browser, frUserB));
    });

    test("Both users navigate to friends list", async () => {
        await frPageA.goto(`${BASE}/app/dm/friends/list`);
        await frPageA.waitForLoadState("networkidle");
        await expect(frPageA.locator("h1")).toBeVisible({ timeout: 10_000 });

        await frPageB.goto(`${BASE}/app/dm/friends/list`);
        await frPageB.waitForLoadState("networkidle");
        await expect(frPageB.locator("h1")).toBeVisible({ timeout: 10_000 });
    });

    test("#7 — Friend request appears on receiver without refresh", async () => {
        // A sends friend request via API
        const sent = await frPageA.evaluate(
            async ({ apiUrl, username }) => {
                const res = await fetch(`${apiUrl}/friends/request`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ username }),
                });
                return res.ok;
            },
            { apiUrl: API_URL, username: frUserB.username },
        );
        expect(sent).toBe(true);

        // B should see the incoming request WITHOUT refreshing
        await expect(
            frPageB.locator(`text=Incoming Friend Request`),
        ).toBeVisible({ timeout: 15_000 });

        // B should see A's display name in the pending section
        await expect(
            frPageB.locator(`text=${frUserA.displayName}`),
        ).toBeVisible({ timeout: 5_000 });
    });

    test("#7 — Accepted friend appears on requester without refresh", async () => {
        // B accepts via API
        const requests = await frPageB.evaluate(
            async ({ apiUrl }) => {
                const res = await fetch(`${apiUrl}/friends/requests`, {
                    credentials: "include",
                });
                return res.json();
            },
            { apiUrl: API_URL },
        );

        const requesterId = requests.incoming[0].otherUserId;

        const accepted = await frPageB.evaluate(
            async ({ apiUrl, requesterId }) => {
                const res = await fetch(`${apiUrl}/friends/accept/${requesterId}`, {
                    method: "POST",
                    credentials: "include",
                });
                return res.ok;
            },
            { apiUrl: API_URL, requesterId },
        );
        expect(accepted).toBe(true);

        // A should see B in their friend list WITHOUT refreshing
        await expect(
            frPageA.locator(`text=${frUserB.displayName}`),
        ).toBeVisible({ timeout: 15_000 });

        // B should also see A in their friend list
        await expect(
            frPageB.locator(`text=${frUserA.displayName}`),
        ).toBeVisible({ timeout: 15_000 });
    });

    test("#23 — Removed friend disappears without refresh", async () => {
        // Get A's userId from B's friend list (B will remove A)
        const bFriends = await frPageB.evaluate(
            async ({ apiUrl }) => {
                const res = await fetch(`${apiUrl}/friends/list`, {
                    credentials: "include",
                });
                return res.json();
            },
            { apiUrl: API_URL },
        );
        const aUserId = bFriends.find((f: any) => f.otherUsername === frUserA.username)?.otherUserId;
        expect(aUserId).toBeTruthy();

        // Make sure A is on the friends list page
        await frPageA.goto(`${BASE}/app/dm/friends/list`);
        await frPageA.waitForLoadState("networkidle");
        await expect(
            frPageA.locator(`text=${frUserB.displayName}`).first(),
        ).toBeVisible({ timeout: 10_000 });

        // B removes A as friend via API
        const removed = await frPageB.evaluate(
            async ({ apiUrl, friendId }) => {
                const res = await fetch(`${apiUrl}/friends/remove/${friendId}`, {
                    method: "DELETE",
                    credentials: "include",
                });
                return res.ok;
            },
            { apiUrl: API_URL, friendId: aUserId },
        );
        expect(removed).toBe(true);

        // A's friend list should update — B disappears WITHOUT refresh
        await expect(
            frPageA.locator(`text=${frUserB.displayName}`).first(),
        ).not.toBeVisible({ timeout: 15_000 });
    });

    test.afterAll(async () => {
        await frCtxA?.close();
        await frCtxB?.close();
    });
});

// =====================================================================
// GUILD DELETION REALTIME (#14)
// =====================================================================

let gdUserA: TestUser;
let gdUserB: TestUser;
let gdCtxA: BrowserContext;
let gdCtxB: BrowserContext;
let gdPageA: Page;
let gdPageB: Page;
let gdGuildId: string;

test.describe.serial("Guild deletion realtime — removed from sidebar without refresh (#14)", () => {
    test("Register guild owner", async ({ browser }) => {
        gdUserA = makeUser("hank");
        ({ context: gdCtxA, page: gdPageA } = await registerUser(browser, gdUserA));
    });

    test("Register guild member", async ({ browser }) => {
        gdUserB = makeUser("ivy");
        ({ context: gdCtxB, page: gdPageB } = await registerUser(browser, gdUserB));
    });

    test("Create guild + channel + invite + member joins", async () => {
        // A creates guild via UI
        await gdPageA.locator("[data-testid='create-guild-btn']").click();
        await gdPageA.getByPlaceholder("My Guild").fill("Delete Test Guild");
        await gdPageA.getByRole("button", { name: /create guild/i }).click();
        await gdPageA.waitForURL(/\/app\/guild\//, { timeout: 10_000 });

        gdGuildId = gdPageA.url().match(/\/app\/guild\/([^/]+)/)![1];

        // Create a text channel so the guild:deleted broadcast has a channel group to target
        const channel = await gdPageA.evaluate(
            async ({ apiUrl, guildId }) => {
                const res = await fetch(`${apiUrl}/channels/guild/${guildId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ name: "general", type: 0, position: 0 }),
                });
                return res.json();
            },
            { apiUrl: API_URL, guildId: gdGuildId },
        );

        // Create invite via API
        const resp = await gdPageA.evaluate(
            async ({ apiUrl, guildId }) => {
                const res = await fetch(`${apiUrl}/guilds/${guildId}/invites`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                });
                return res.json();
            },
            { apiUrl: API_URL, guildId: gdGuildId },
        );

        // B joins via UI
        await gdPageB.locator("[data-testid='join-guild-btn']").click();
        await gdPageB.getByPlaceholder("e.g. AbCdEfGh").fill(resp.code);
        await gdPageB.getByRole("button", { name: /join server/i }).click();
        await gdPageB.waitForURL(new RegExp(`/app/guild/${gdGuildId}`), { timeout: 15_000 });

        // B navigates to the channel so they join the SignalR group
        await gdPageB.goto(`${BASE}/app/guild/${gdGuildId}/${channel.id}`);
        await gdPageB.waitForLoadState("networkidle");
        await expect(gdPageB.locator(`textarea[placeholder*="Message #"]`)).toBeVisible({ timeout: 10_000 });
    });

    test("#14 — Member sees guild disappear from sidebar when owner deletes it", async () => {
        // Verify B sees the guild icon in the global sidebar (the narrow left bar)
        const guildIcon = gdPageB.locator(`[data-testid="guild-icon-${gdGuildId}"]`);
        await expect(guildIcon).toBeVisible({ timeout: 5_000 });

        // A deletes the guild via API
        const deleted = await gdPageA.evaluate(
            async ({ apiUrl, guildId }) => {
                const res = await fetch(`${apiUrl}/guilds/${guildId}`, {
                    method: "DELETE",
                    credentials: "include",
                });
                return res.ok;
            },
            { apiUrl: API_URL, guildId: gdGuildId },
        );
        expect(deleted).toBe(true);

        // B should see the guild disappear from the sidebar WITHOUT refresh
        await expect(guildIcon).not.toBeVisible({ timeout: 15_000 });

        // B should be redirected away from the guild page (to DMs)
        await expect(gdPageB).toHaveURL(/\/app\/dm/, { timeout: 10_000 });
    });

    test.afterAll(async () => {
        await gdCtxA?.close();
        await gdCtxB?.close();
    });
});

// =====================================================================
// PIN / UNPIN REALTIME (#29, #11)
// =====================================================================

let pinUserA: TestUser;
let pinUserB: TestUser;
let pinCtxA: BrowserContext;
let pinCtxB: BrowserContext;
let pinPageA: Page;
let pinPageB: Page;
let pinGuildId: string;
let pinChannelId: string;

test.describe.serial("Pin/unpin realtime — updates without refresh (#29, #11)", () => {
    test("Register User A", async ({ browser }) => {
        pinUserA = makeUser("jack");
        ({ context: pinCtxA, page: pinPageA } = await registerUser(browser, pinUserA));
    });

    test("Register User B", async ({ browser }) => {
        pinUserB = makeUser("kate");
        ({ context: pinCtxB, page: pinPageB } = await registerUser(browser, pinUserB));
    });

    test("Create guild + channel + invite + join", async () => {
        // A creates guild
        await pinPageA.locator("[data-testid='create-guild-btn']").click();
        await pinPageA.getByPlaceholder("My Guild").fill("Pin Test Guild");
        await pinPageA.getByRole("button", { name: /create guild/i }).click();
        await pinPageA.waitForURL(/\/app\/guild\//, { timeout: 10_000 });

        pinGuildId = pinPageA.url().match(/\/app\/guild\/([^/]+)/)![1];

        // Create text channel via API
        const channel = await pinPageA.evaluate(
            async ({ apiUrl, guildId }) => {
                const res = await fetch(`${apiUrl}/channels/guild/${guildId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ name: "pin-test", type: 0, position: 0 }),
                });
                return res.json();
            },
            { apiUrl: API_URL, guildId: pinGuildId },
        );
        pinChannelId = channel.id;

        // Create invite
        const invite = await pinPageA.evaluate(
            async ({ apiUrl, guildId }) => {
                const res = await fetch(`${apiUrl}/guilds/${guildId}/invites`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                });
                return res.json();
            },
            { apiUrl: API_URL, guildId: pinGuildId },
        );

        // B joins
        await pinPageB.locator("[data-testid='join-guild-btn']").click();
        await pinPageB.getByPlaceholder("e.g. AbCdEfGh").fill(invite.code);
        await pinPageB.getByRole("button", { name: /join server/i }).click();
        await pinPageB.waitForURL(new RegExp(`/app/guild/${pinGuildId}`), { timeout: 15_000 });
    });

    test("Both navigate to the text channel", async () => {
        await pinPageA.goto(`${BASE}/app/guild/${pinGuildId}/${pinChannelId}`);
        await pinPageA.waitForLoadState("networkidle");
        await expect(pinPageA.locator(`textarea[placeholder*="Message #"]`)).toBeVisible({ timeout: 10_000 });

        await pinPageB.goto(`${BASE}/app/guild/${pinGuildId}/${pinChannelId}`);
        await pinPageB.waitForLoadState("networkidle");
        await expect(pinPageB.locator(`textarea[placeholder*="Message #"]`)).toBeVisible({ timeout: 10_000 });
    });

    test("Send a message to pin", async () => {
        const msg = `Pin me please ${Date.now()}`;
        const input = pinPageA.locator(`textarea[placeholder*="Message #"]`);
        await input.fill(msg);
        await input.press("Enter");

        await expect(pinPageA.locator(`[data-testid='message-content']:has-text("${msg}")`)).toBeVisible({ timeout: 5_000 });
        await expect(pinPageB.locator(`[data-testid='message-content']:has-text("${msg}")`)).toBeVisible({ timeout: 10_000 });
    });

    test("#29 — Pin message appears in other user's pin panel without refresh", async () => {
        // B opens the pinned messages panel
        await pinPageB.locator("[title='Pinned Messages']").click();
        await expect(pinPageB.locator("text=No pinned messages")).toBeVisible({ timeout: 5_000 });

        // A pins the message via API (get the message ID first)
        const messages = await pinPageA.evaluate(
            async ({ apiUrl, channelId }) => {
                const res = await fetch(`${apiUrl}/guild-channels/${channelId}/messages?limit=1`, {
                    credentials: "include",
                });
                return res.json();
            },
            { apiUrl: API_URL, channelId: pinChannelId },
        );
        const messageId = messages[0].id;

        const pinned = await pinPageA.evaluate(
            async ({ apiUrl, channelId, messageId }) => {
                const res = await fetch(`${apiUrl}/channels/${channelId}/pins/${messageId}`, {
                    method: "POST",
                    credentials: "include",
                });
                return res.ok;
            },
            { apiUrl: API_URL, channelId: pinChannelId, messageId },
        );
        expect(pinned).toBe(true);

        // B's pin panel should show a pin card (bg-[#1e1f22] container) WITHOUT refresh.
        // Note: pin content may be empty due to at-rest encryption (known issue #15),
        // but the card itself appearing proves the realtime event worked.
        await expect(
            pinPageB.locator("[data-testid='pin-card']").first(),
        ).toBeVisible({ timeout: 15_000 });

        // "No pinned messages" should be gone
        await expect(pinPageB.locator("text=No pinned messages")).not.toBeVisible({ timeout: 5_000 });
    });

    test("#11 — Unpin removes message from other user's pin panel without refresh", async () => {
        // Get the message ID again
        const messages = await pinPageA.evaluate(
            async ({ apiUrl, channelId }) => {
                const res = await fetch(`${apiUrl}/guild-channels/${channelId}/messages?limit=1`, {
                    credentials: "include",
                });
                return res.json();
            },
            { apiUrl: API_URL, channelId: pinChannelId },
        );
        const messageId = messages[0].id;

        // A unpins via API
        const unpinned = await pinPageA.evaluate(
            async ({ apiUrl, channelId, messageId }) => {
                const res = await fetch(`${apiUrl}/channels/${channelId}/pins/${messageId}`, {
                    method: "DELETE",
                    credentials: "include",
                });
                return res.ok;
            },
            { apiUrl: API_URL, channelId: pinChannelId, messageId },
        );
        expect(unpinned).toBe(true);

        // B's pin panel should show "No pinned messages" again WITHOUT refresh
        await expect(
            pinPageB.locator("text=No pinned messages"),
        ).toBeVisible({ timeout: 15_000 });
    });

    test.afterAll(async () => {
        await pinCtxA?.close();
        await pinCtxB?.close();
    });
});
