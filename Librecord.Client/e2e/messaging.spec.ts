import { test, expect } from "@playwright/test";
import { makeUser, registerUser, type TestUser } from "./helpers";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * Comprehensive messaging tests covering:
 *
 * GUILD MESSAGES:
 *   - Send a message, verify it appears on both users' screens in real-time
 *   - Send multiple messages, verify ordering
 *   - Edit a message, verify edit appears on other user's screen + "(edited)" label
 *   - Delete a message, verify it disappears on both screens
 *   - Typing indicator: one user types, other sees "X is typing..."
 *   - Unread badge: message in non-active channel shows unread count
 *
 * DMs:
 *   - Alice sends Bob a friend request, Bob accepts
 *   - Alice starts a DM with Bob
 *   - Send/receive messages in real-time
 *   - Edit + delete in DM
 *   - Typing indicator in DM
 *   - Unread badge in DM sidebar
 *   - Bob receives notification for DM while on a different page
 */

const API_URL = "https://localhost:5111";

let userA: TestUser;
let userB: TestUser;
let ctxA: BrowserContext;
let ctxB: BrowserContext;
let pageA: Page;
let pageB: Page;

let guildId: string;
let inviteCode: string;
let textChannelId: string;
let textChannelName: string;

test.describe.serial("Guild messaging — send, receive, edit, delete, notifications", () => {
    // ─── SETUP ───────────────────────────────────────────────────────

    test("Register User A", async ({ browser }) => {
        userA = makeUser("alice");
        ({ context: ctxA, page: pageA } = await registerUser(browser, userA));
    });

    test("Register User B", async ({ browser }) => {
        userB = makeUser("bob");
        ({ context: ctxB, page: pageB } = await registerUser(browser, userB));
    });

    test("Create guild + invite + Bob joins", async () => {
        // A creates guild
        await pageA.locator("div.group:has(div:text-is('Create a Server')) > div.cursor-pointer").click();
        await pageA.getByPlaceholder("My Guild").fill("Messaging Test Guild");
        await pageA.getByRole("button", { name: /create guild/i }).click();
        await pageA.waitForURL(/\/app\/guild\//, { timeout: 10_000 });

        guildId = pageA.url().match(/\/app\/guild\/([^/]+)/)![1];

        // Create invite via API
        const resp = await pageA.evaluate(
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
        inviteCode = resp.code;

        // B joins
        await pageB.locator("div.group:has(div:text-is('Join a Server')) > div.cursor-pointer").click();
        await pageB.getByPlaceholder("e.g. AbCdEfGh").fill(inviteCode);
        await pageB.getByRole("button", { name: /join server/i }).click();
        await pageB.waitForURL(new RegExp(`/app/guild/${guildId}`), { timeout: 15_000 });
    });

    test("Both users navigate to the text channel", async () => {
        await pageA.waitForSelector("text=Text Channels", { timeout: 10_000 });

        // Guild creation doesn't auto-create channels. Create one if needed.
        const textChannelLinks = pageA.locator(`a[href^="/app/guild/${guildId}/"]`);
        if ((await textChannelLinks.count()) === 0) {
            const channel = await pageA.evaluate(
                async ({ apiUrl, guildId }) => {
                    const res = await fetch(`${apiUrl}/channels/guild/${guildId}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ name: "general", type: 0, position: 0 }),
                    });
                    return res.json();
                },
                { apiUrl: API_URL, guildId },
            );
            expect(channel.id).toBeTruthy();

            await pageA.reload();
            await pageA.waitForSelector("text=Text Channels", { timeout: 10_000 });
        }

        const firstLink = pageA.locator(`a[href^="/app/guild/${guildId}/"]`).first();
        await expect(firstLink).toBeVisible({ timeout: 5_000 });

        textChannelName = (await firstLink.locator("span.truncate").textContent())!.trim();

        await firstLink.click();
        await pageA.waitForURL(/\/app\/guild\/[^/]+\/[^/]+/, { timeout: 5_000 });
        textChannelId = pageA.url().match(/\/app\/guild\/[^/]+\/([^/]+)/)![1];

        // B navigates to same channel
        await pageB.reload();
        await pageB.waitForSelector("text=Text Channels", { timeout: 10_000 });
        await pageB.locator(`a[href="/app/guild/${guildId}/${textChannelId}"]`).click();
        await pageB.waitForURL(new RegExp(textChannelId), { timeout: 5_000 });
    });

    // ─── SEND & RECEIVE ──────────────────────────────────────────────

    test("Alice sends a message, Bob sees it in real-time", async () => {
        const msg = `Hello from Alice! ${Date.now()}`;

        // Type in message input
        const input = pageA.locator(`textarea[placeholder*="Message #"]`);
        await input.fill(msg);
        await input.press("Enter");

        // Alice should see her own message
        await expect(pageA.locator(`.message-content:has-text("${msg}")`)).toBeVisible({ timeout: 5_000 });

        // Bob should see Alice's message in real-time
        await expect(pageB.locator(`.message-content:has-text("${msg}")`)).toBeVisible({ timeout: 10_000 });
    });

    test("Bob sends a message, Alice sees it in real-time", async () => {
        const msg = `Hello from Bob! ${Date.now()}`;

        const input = pageB.locator(`textarea[placeholder*="Message #"]`);
        await input.fill(msg);
        await input.press("Enter");

        await expect(pageB.locator(`.message-content:has-text("${msg}")`)).toBeVisible({ timeout: 5_000 });
        await expect(pageA.locator(`.message-content:has-text("${msg}")`)).toBeVisible({ timeout: 10_000 });
    });

    test("Messages appear in correct order", async () => {
        const msg1 = `Order test 1 - ${Date.now()}`;
        const msg2 = `Order test 2 - ${Date.now()}`;
        const msg3 = `Order test 3 - ${Date.now()}`;

        const input = pageA.locator(`textarea[placeholder*="Message #"]`);

        await input.fill(msg1);
        await input.press("Enter");
        await expect(pageA.locator(`.message-content:has-text("${msg1}")`)).toBeVisible({ timeout: 5_000 });

        await input.fill(msg2);
        await input.press("Enter");
        await expect(pageA.locator(`.message-content:has-text("${msg2}")`)).toBeVisible({ timeout: 5_000 });

        await input.fill(msg3);
        await input.press("Enter");
        await expect(pageA.locator(`.message-content:has-text("${msg3}")`)).toBeVisible({ timeout: 5_000 });

        // Verify order on Bob's side: msg1 should be ABOVE msg3
        await expect(pageB.locator(`.message-content:has-text("${msg3}")`)).toBeVisible({ timeout: 10_000 });

        const allMessages = pageB.locator(".message-content");
        const texts = await allMessages.allTextContents();
        const idx1 = texts.findIndex(t => t.includes(msg1));
        const idx2 = texts.findIndex(t => t.includes(msg2));
        const idx3 = texts.findIndex(t => t.includes(msg3));

        expect(idx1).toBeLessThan(idx2);
        expect(idx2).toBeLessThan(idx3);
    });

    // ─── EDIT ────────────────────────────────────────────────────────

    test("Alice edits a message, Bob sees the edit + (edited) label", async () => {
        const original = `Editable message ${Date.now()}`;
        const edited = `Edited message ${Date.now()}`;

        // Alice sends a message
        const input = pageA.locator(`textarea[placeholder*="Message #"]`);
        await input.fill(original);
        await input.press("Enter");

        await expect(pageA.locator(`.message-content:has-text("${original}")`)).toBeVisible({ timeout: 5_000 });
        await expect(pageB.locator(`.message-content:has-text("${original}")`)).toBeVisible({ timeout: 10_000 });

        // Hover over the message to reveal action buttons, then click Edit
        const msgRow = pageA.locator(`.group:has(.message-content:has-text("${original}"))`);
        await msgRow.hover();
        await msgRow.locator("[title='Edit']").click();

        // Edit textarea should appear with the original content
        const editTextarea = pageA.locator("textarea.border-\\[\\#5865F2\\]");
        await expect(editTextarea).toBeVisible({ timeout: 3_000 });

        // Clear and type new content
        await editTextarea.fill(edited);
        await editTextarea.press("Enter");

        // Alice sees the edited content
        await expect(pageA.locator(`.message-content:has-text("${edited}")`)).toBeVisible({ timeout: 5_000 });
        // Original should be gone
        await expect(pageA.locator(`.message-content:has-text("${original}")`)).not.toBeVisible({ timeout: 3_000 });
        // "(edited)" label should appear
        await expect(pageA.locator("text=(edited)").last()).toBeVisible();

        // Bob sees the edit in real-time
        await expect(pageB.locator(`.message-content:has-text("${edited}")`)).toBeVisible({ timeout: 10_000 });
        await expect(pageB.locator(`.message-content:has-text("${original}")`)).not.toBeVisible();
        await expect(pageB.locator("text=(edited)").last()).toBeVisible();
    });

    // ─── DELETE ──────────────────────────────────────────────────────

    test("Alice deletes a message, it disappears on both screens", async () => {
        const msg = `Delete me ${Date.now()}`;

        const input = pageA.locator(`textarea[placeholder*="Message #"]`);
        await input.fill(msg);
        await input.press("Enter");

        await expect(pageA.locator(`.message-content:has-text("${msg}")`)).toBeVisible({ timeout: 5_000 });
        await expect(pageB.locator(`.message-content:has-text("${msg}")`)).toBeVisible({ timeout: 10_000 });

        // Hover and click delete
        const msgRow = pageA.locator(`.group:has(.message-content:has-text("${msg}"))`);
        await msgRow.hover();
        await msgRow.locator("[title='Delete']").click();

        // Confirm the "Delete Message" modal
        await pageA.locator("button.bg-\\[\\#da373c\\]").click();

        // Message should disappear from both
        await expect(pageA.locator(`.message-content:has-text("${msg}")`)).not.toBeVisible({ timeout: 10_000 });
        await expect(pageB.locator(`.message-content:has-text("${msg}")`)).not.toBeVisible({ timeout: 10_000 });
    });

    // ─── TYPING INDICATOR ────────────────────────────────────────────

    test("Alice types, Bob sees typing indicator", async () => {
        const selector = `textarea[placeholder*="Message #"]`;
        const sentence = "Hey Bob, how are you doing today?";

        // Type one letter at a time like a real human (~400ms per keystroke).
        // Use the native value setter so React's onChange fires each time.
        for (let i = 0; i < sentence.length; i++) {
            await pageA.evaluate(({ sel, text }) => {
                const el = document.querySelector(sel) as HTMLTextAreaElement;
                if (!el) return;
                el.focus();
                const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype, "value"
                )!.set!;
                setter.call(el, text);
                el.dispatchEvent(new Event("input", { bubbles: true }));
            }, { sel: selector, text: sentence.slice(0, i + 1) });

            await pageA.waitForTimeout(400);
        }

        // Bob should see the typing indicator
        await expect(
            pageB.locator(`text=${userA.displayName} is typing...`),
        ).toBeVisible({ timeout: 10_000 });

        // Clear without sending
        await pageA.locator(selector).fill("");

        // Typing indicator should eventually disappear (5s expiry)
        await expect(
            pageB.locator(`text=${userA.displayName} is typing...`),
        ).not.toBeVisible({ timeout: 10_000 });
    });

    // ─── UNREAD BADGE (GUILD) ────────────────────────────────────────

    test("Bob gets unread badge when Alice messages a channel Bob isn't viewing", async () => {
        // First, create a second text channel via API
        const channel2 = await pageA.evaluate(
            async ({ apiUrl, guildId }) => {
                const res = await fetch(`${apiUrl}/channels/guild/${guildId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ name: "second-channel", type: 0, position: 1 }),
                });
                return res.json();
            },
            { apiUrl: API_URL, guildId },
        );

        // Reload both to see new channel and rejoin SignalR groups
        await pageA.reload();
        await pageA.waitForSelector("text=Text Channels", { timeout: 10_000 });
        await pageB.reload();
        await pageB.waitForSelector("text=Text Channels", { timeout: 10_000 });

        // Bob stays on the first channel — click and wait for message input
        await pageB.locator(`a[href="/app/guild/${guildId}/${textChannelId}"]`).click();
        await expect(pageB.locator(`textarea[placeholder*="Message #"]`)).toBeVisible({ timeout: 5_000 });

        // Alice navigates to the second channel — wait for message input
        await pageA.locator('a:has(span.truncate:has-text("second-channel"))').first().click();
        await pageA.waitForURL(new RegExp(channel2.id), { timeout: 5_000 });
        await expect(pageA.locator(`textarea[placeholder*="Message #"]`)).toBeVisible({ timeout: 5_000 });

        // Alice sends a message in second-channel
        const msg = `Unread test ${Date.now()}`;
        const input = pageA.locator(`textarea[placeholder*="Message #"]`);
        await input.fill(msg);
        await input.press("Enter");
        await expect(pageA.locator(`.message-content:has-text("${msg}")`)).toBeVisible({ timeout: 5_000 });

        // Bob should see an unread badge next to "second-channel" in the sidebar
        // The UnreadBadge is a span with bg-red-500 text
        await expect(
            pageB.locator('a:has(span.truncate:has-text("second-channel"))').locator("span.bg-red-500"),
        ).toBeVisible({ timeout: 10_000 });

        // Bob navigates to the second channel — badge should clear
        await pageB.locator('a:has(span.truncate:has-text("second-channel"))').first().click();
        await expect(
            pageB.locator(`.message-content:has-text("${msg}")`),
        ).toBeVisible({ timeout: 5_000 });

        // Navigate back — Alice sends to first channel
        await pageA.locator(`a:has(span.truncate:has-text("${textChannelName}"))`).first().click();
        await pageA.waitForTimeout(500);
    });

    // ─── CLEANUP ─────────────────────────────────────────────────────

    test.afterAll(async () => {
        await ctxA?.close();
        await ctxB?.close();
    });
});

// =====================================================================
// DM MESSAGING
// =====================================================================

let dmUserA: TestUser;
let dmUserB: TestUser;
let dmCtxA: BrowserContext;
let dmCtxB: BrowserContext;
let dmPageA: Page;
let dmPageB: Page;
let dmChannelId: string;

test.describe.serial("DM messaging — friend request, send, receive, edit, delete, notifications", () => {
    // ─── SETUP: REGISTER + FRIEND REQUEST ────────────────────────────

    test("Register DM User A", async ({ browser }) => {
        dmUserA = makeUser("diana");
        ({ context: dmCtxA, page: dmPageA } = await registerUser(browser, dmUserA));
    });

    test("Register DM User B", async ({ browser }) => {
        dmUserB = makeUser("eric");
        ({ context: dmCtxB, page: dmPageB } = await registerUser(browser, dmUserB));
    });

    test("User A sends friend request to User B, User B accepts", async () => {
        // A sends friend request via API
        const sent = await dmPageA.evaluate(
            async ({ apiUrl, username }) => {
                const res = await fetch(`${apiUrl}/friends/request`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ username }),
                });
                return res.ok;
            },
            { apiUrl: API_URL, username: dmUserB.username },
        );
        expect(sent).toBe(true);

        // B gets A's user ID from the pending requests
        const requests = await dmPageB.evaluate(
            async ({ apiUrl }) => {
                const res = await fetch(`${apiUrl}/friends/requests`, {
                    credentials: "include",
                });
                return res.json();
            },
            { apiUrl: API_URL },
        );

        expect(requests.incoming.length).toBeGreaterThan(0);
        const requesterId = requests.incoming[0].otherUserId;

        // B accepts
        const accepted = await dmPageB.evaluate(
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
    });

    // ─── START DM ────────────────────────────────────────────────────

    test("User A starts a DM with User B", async () => {
        // Get B's user ID
        const friends = await dmPageA.evaluate(
            async ({ apiUrl }) => {
                const res = await fetch(`${apiUrl}/friends/list`, {
                    credentials: "include",
                });
                return res.json();
            },
            { apiUrl: API_URL },
        );

        const bobFriend = friends.find((f: any) => f.otherUsername === dmUserB.username);
        expect(bobFriend).toBeTruthy();

        // Start DM via API
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
            { apiUrl: API_URL, targetUserId: bobFriend.otherUserId },
        );

        expect(result.channelId).toBeTruthy();
        dmChannelId = result.channelId;

        // Navigate A to the DM
        await dmPageA.goto(`https://localhost:5173/app/dm/${dmChannelId}`);
        await dmPageA.waitForLoadState("networkidle");
    });

    test("User B navigates to DMs and sees the conversation", async () => {
        // Navigate directly to the DM conversation so the page load triggers
        // a fresh SignalR connection that joins the DM channel group.
        await dmPageB.goto(`https://localhost:5173/app/dm/${dmChannelId}`);
        await dmPageB.waitForLoadState("networkidle");

        // B should see A's name in the DM sidebar
        await expect(
            dmPageB.locator(`text=${dmUserA.displayName}`).first(),
        ).toBeVisible({ timeout: 10_000 });

        // Wait for the message input to appear (page fully rendered)
        await expect(
            dmPageB.locator(`textarea[placeholder*="Message"]`),
        ).toBeVisible({ timeout: 10_000 });

        // Also reload Alice's DM page to ensure her SignalR connection is fresh
        await dmPageA.goto(`https://localhost:5173/app/dm/${dmChannelId}`);
        await dmPageA.waitForLoadState("networkidle");
        await expect(
            dmPageA.locator(`textarea[placeholder*="Message"]`),
        ).toBeVisible({ timeout: 10_000 });
    });

    // ─── DM SEND & RECEIVE ──────────────────────────────────────────

    test("User A sends a DM, User B receives it in real-time", async () => {
        const msg = `DM from Diana ${Date.now()}`;

        const input = dmPageA.locator(`textarea[placeholder*="Message"]`);
        await input.fill(msg);
        await input.press("Enter");

        // A sees it
        await expect(dmPageA.locator(`.message-content:has-text("${msg}")`)).toBeVisible({ timeout: 5_000 });
        // B sees it in real-time
        await expect(dmPageB.locator(`.message-content:has-text("${msg}")`)).toBeVisible({ timeout: 10_000 });
    });

    test("User B sends a DM, User A receives it in real-time", async () => {
        const msg = `DM from Eric ${Date.now()}`;

        const input = dmPageB.locator(`textarea[placeholder*="Message"]`);
        await input.fill(msg);
        await input.press("Enter");

        await expect(dmPageB.locator(`.message-content:has-text("${msg}")`)).toBeVisible({ timeout: 5_000 });
        await expect(dmPageA.locator(`.message-content:has-text("${msg}")`)).toBeVisible({ timeout: 10_000 });
    });

    // ─── DM EDIT ─────────────────────────────────────────────────────

    test("User A edits a DM, User B sees the edit", async () => {
        const original = `DM edit test ${Date.now()}`;
        const edited = `DM edited ${Date.now()}`;

        const input = dmPageA.locator(`textarea[placeholder*="Message"]`);
        await input.fill(original);
        await input.press("Enter");

        await expect(dmPageA.locator(`.message-content:has-text("${original}")`)).toBeVisible({ timeout: 5_000 });
        await expect(dmPageB.locator(`.message-content:has-text("${original}")`)).toBeVisible({ timeout: 10_000 });

        // Hover + click edit
        const msgRow = dmPageA.locator(`.group:has(.message-content:has-text("${original}"))`);
        await msgRow.hover();
        await msgRow.locator("[title='Edit']").click();

        const editTextarea = dmPageA.locator("textarea.border-\\[\\#5865F2\\]");
        await expect(editTextarea).toBeVisible({ timeout: 3_000 });
        await editTextarea.fill(edited);
        await editTextarea.press("Enter");

        // Both see the edit
        await expect(dmPageA.locator(`.message-content:has-text("${edited}")`)).toBeVisible({ timeout: 5_000 });
        await expect(dmPageB.locator(`.message-content:has-text("${edited}")`)).toBeVisible({ timeout: 10_000 });

        // "(edited)" label on both
        await expect(dmPageA.locator("text=(edited)").last()).toBeVisible();
        await expect(dmPageB.locator("text=(edited)").last()).toBeVisible();
    });

    // ─── DM DELETE ───────────────────────────────────────────────────

    test("User A deletes a DM, it disappears on both screens", async () => {
        const msg = `DM delete me ${Date.now()}`;

        const input = dmPageA.locator(`textarea[placeholder*="Message"]`);
        await input.fill(msg);
        await input.press("Enter");

        await expect(dmPageA.locator(`.message-content:has-text("${msg}")`)).toBeVisible({ timeout: 5_000 });
        await expect(dmPageB.locator(`.message-content:has-text("${msg}")`)).toBeVisible({ timeout: 10_000 });

        const msgRow = dmPageA.locator(`.group:has(.message-content:has-text("${msg}"))`);
        await msgRow.hover();
        await msgRow.locator("[title='Delete']").click();

        // Confirm the "Delete Message" modal
        await dmPageA.locator("button.bg-\\[\\#da373c\\]").click();

        await expect(dmPageA.locator(`.message-content:has-text("${msg}")`)).not.toBeVisible({ timeout: 10_000 });
        await expect(dmPageB.locator(`.message-content:has-text("${msg}")`)).not.toBeVisible({ timeout: 10_000 });
    });

    // ─── DM TYPING INDICATOR ────────────────────────────────────────

    test("User A types in DM, User B sees typing indicator", async () => {
        const selector = `textarea[placeholder*="Message"]`;
        const sentence = "Hey Eric, want to hop on a call?";

        for (let i = 0; i < sentence.length; i++) {
            await dmPageA.evaluate(({ sel, text }) => {
                const el = document.querySelector(sel) as HTMLTextAreaElement;
                if (!el) return;
                el.focus();
                const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype, "value"
                )!.set!;
                setter.call(el, text);
                el.dispatchEvent(new Event("input", { bubbles: true }));
            }, { sel: selector, text: sentence.slice(0, i + 1) });

            await dmPageA.waitForTimeout(400);
        }

        await expect(
            dmPageB.locator(`text=${dmUserA.displayName} is typing...`),
        ).toBeVisible({ timeout: 10_000 });

        await dmPageA.locator(selector).fill("");

        await expect(
            dmPageB.locator(`text=${dmUserA.displayName} is typing...`),
        ).not.toBeVisible({ timeout: 10_000 });
    });

    // ─── DM UNREAD BADGE ────────────────────────────────────────────

    test("User B gets unread badge when User A sends a DM while B is elsewhere", async () => {
        // B navigates away from the DM to the friends page
        await dmPageB.goto("https://localhost:5173/app/dm/friends/list");
        await dmPageB.waitForLoadState("networkidle");

        // A sends a message
        const msg = `Unread DM ${Date.now()}`;
        const input = dmPageA.locator(`textarea[placeholder*="Message"]`);
        await input.fill(msg);
        await input.press("Enter");
        await expect(dmPageA.locator(`.message-content:has-text("${msg}")`)).toBeVisible({ timeout: 5_000 });

        // B should see an unread badge in the DM sidebar
        // The UnreadBadge renders a span.bg-red-500 inside the DM link
        await expect(
            dmPageB.locator(`a[href="/app/dm/${dmChannelId}"]`).locator("span.bg-red-500"),
        ).toBeVisible({ timeout: 10_000 });

        // B clicks the DM — badge clears, message visible
        await dmPageB.locator(`a[href="/app/dm/${dmChannelId}"]`).click();
        await expect(dmPageB.locator(`.message-content:has-text("${msg}")`)).toBeVisible({ timeout: 5_000 });

        // Badge should be gone
        await expect(
            dmPageB.locator(`a[href="/app/dm/${dmChannelId}"]`).locator("span.bg-red-500"),
        ).not.toBeVisible({ timeout: 5_000 });
    });

    // ─── MULTIPLE RAPID MESSAGES ────────────────────────────────────

    test("Rapid message burst: 5 messages sent quickly, all arrive in order", async () => {
        const messages = Array.from({ length: 5 }, (_, i) => `Burst ${i + 1} - ${Date.now()}`);

        const input = dmPageA.locator(`textarea[placeholder*="Message"]`);
        for (const msg of messages) {
            await input.fill(msg);
            await input.press("Enter");
            // Small delay to ensure ordering
            await dmPageA.waitForTimeout(100);
        }

        // Wait for last message to appear on B
        await expect(
            dmPageB.locator(`.message-content:has-text("${messages[4]}")`),
        ).toBeVisible({ timeout: 15_000 });

        // Verify order
        const allContent = await dmPageB.locator(".message-content").allTextContents();
        const indices = messages.map(m => allContent.findIndex(t => t.includes(m)));

        for (let i = 0; i < indices.length - 1; i++) {
            expect(indices[i]).toBeLessThan(indices[i + 1]);
        }
    });

    // ─── EDIT CANCEL WITH ESCAPE ────────────────────────────────────

    test("Edit cancel with Escape preserves original message", async () => {
        const original = `Don't edit me ${Date.now()}`;

        const input = dmPageA.locator(`textarea[placeholder*="Message"]`);
        await input.fill(original);
        await input.press("Enter");

        await expect(dmPageA.locator(`.message-content:has-text("${original}")`)).toBeVisible({ timeout: 5_000 });

        // Start editing
        const msgRow = dmPageA.locator(`.group:has(.message-content:has-text("${original}"))`);
        await msgRow.hover();
        await msgRow.locator("[title='Edit']").click();

        const editTextarea = dmPageA.locator("textarea.border-\\[\\#5865F2\\]");
        await expect(editTextarea).toBeVisible({ timeout: 3_000 });

        // Type something different but press Escape
        await editTextarea.fill("This should not save");
        await editTextarea.press("Escape");

        // Original message should still be there, unchanged
        await expect(dmPageA.locator(`.message-content:has-text("${original}")`)).toBeVisible();
        // No "(edited)" label
        await expect(dmPageA.locator(`.group:has(.message-content:has-text("${original}")) >> text=(edited)`)).not.toBeVisible();
    });

    // ─── CLEANUP ─────────────────────────────────────────────────────

    test.afterAll(async () => {
        await dmCtxA?.close();
        await dmCtxB?.close();
    });
});
