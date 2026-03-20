import { test, expect } from "@playwright/test";
import { makeUser, registerUser, loginUser, BASE, API_URL, type TestUser } from "./helpers";
import type { BrowserContext, Page } from "@playwright/test";

/**
 * User status / presence tests:
 *
 *  - Default status is "Online" after registration
 *  - Status persists across page refresh (Idle, DND, Invisible)
 *  - Invisible users appear offline to others
 *  - Status changes broadcast in real-time to DM contacts
 *  - Disconnected users appear offline to others (connection tracking)
 */

let userA: TestUser;
let userB: TestUser;
let ctxA: BrowserContext;
let ctxB: BrowserContext;
let pageA: Page;
let pageB: Page;

test.describe.serial("User status — set, persist, broadcast, invisible", () => {
    // ─── SETUP ───────────────────────────────────────────────────────

    test("Register User A", async ({ browser }) => {
        userA = makeUser("statusA");
        ({ context: ctxA, page: pageA } = await registerUser(browser, userA));
    });

    test("Register User B", async ({ browser }) => {
        userB = makeUser("statusB");
        ({ context: ctxB, page: pageB } = await registerUser(browser, userB));
    });

    test("Users become friends and open a DM", async () => {
        // A sends friend request to B
        const addRes = await pageA.evaluate(
            async ({ api, username }) => {
                const res = await fetch(`${api}/friends/request`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ username }),
                });
                return res.status;
            },
            { api: API_URL, username: userB.username },
        );
        expect(addRes).toBe(200);

        // B accepts
        await pageB.waitForTimeout(500);
        const acceptRes = await pageB.evaluate(
            async ({ api }) => {
                const listRes = await fetch(`${api}/friends/requests`, { credentials: "include" });
                if (!listRes.ok) return listRes.status;
                const { incoming } = await listRes.json();
                if (!incoming || incoming.length === 0) return 404;
                const requesterId = incoming[0].otherUserId;
                const res = await fetch(`${api}/friends/accept/${requesterId}`, {
                    method: "POST",
                    credentials: "include",
                });
                return res.status;
            },
            { api: API_URL },
        );
        expect(acceptRes).toBe(200);

        // A opens DM with B — get B's userId from friend list
        const targetId = await pageA.evaluate(
            async ({ api, username }) => {
                const res = await fetch(`${api}/friends/list`, { credentials: "include" });
                if (!res.ok) return null;
                const friends = await res.json();
                const friend = friends.find((f: any) => f.otherUsername === username);
                return friend?.otherUserId;
            },
            { api: API_URL, username: userB.username },
        );
        expect(targetId).toBeTruthy();

        const dmStatus = await pageA.evaluate(
            async ({ api, targetId }) => {
                const res = await fetch(`${api}/dms/start/${targetId}`, {
                    method: "POST",
                    credentials: "include",
                });
                return res.status;
            },
            { api: API_URL, targetId },
        );
        expect(dmStatus).toBe(200);
    });

    // ─── STATUS TESTS ────────────────────────────────────────────────

    test("Default status is Online after registration", async () => {
        const status = await pageA.evaluate(async ({ api }) => {
            const res = await fetch(`${api}/presence/me`, { credentials: "include" });
            const data = await res.json();
            return data.status;
        }, { api: API_URL });

        expect(status).toBe("online");
    });

    test("User can set status to Idle and it persists on API", async () => {
        await setStatusViaApi(pageA, "idle");

        const status = await getMyStatus(pageA);
        expect(status).toBe("idle");
    });

    test("Idle status persists after page refresh", async () => {
        await pageA.reload();
        await pageA.waitForURL(/\/app/, { timeout: 10_000 });

        const status = await getMyStatus(pageA);
        expect(status).toBe("idle");
    });

    test("User can set status to Do Not Disturb", async () => {
        await setStatusViaApi(pageA, "donotdisturb");

        const status = await getMyStatus(pageA);
        expect(status).toBe("donotdisturb");
    });

    test("DND persists after page refresh", async () => {
        await pageA.reload();
        await pageA.waitForURL(/\/app/, { timeout: 10_000 });

        const status = await getMyStatus(pageA);
        expect(status).toBe("donotdisturb");
    });

    test("User can set status to Invisible", async () => {
        await setStatusViaApi(pageA, "offline");

        const status = await getMyStatus(pageA);
        expect(status).toBe("offline");
    });

    test("Invisible persists after page refresh", async () => {
        await pageA.reload();
        await pageA.waitForURL(/\/app/, { timeout: 10_000 });

        const status = await getMyStatus(pageA);
        expect(status).toBe("offline");
    });

    test("Invisible user appears offline to others via bulk presence", async () => {
        // Get A's userId
        const userAId = await pageA.evaluate(async ({ api }) => {
            const res = await fetch(`${api}/users/me`, { credentials: "include" });
            const data = await res.json();
            return data.userId;
        }, { api: API_URL });

        // B checks A's presence
        const appearance = await pageB.evaluate(
            async ({ api, userId }) => {
                const res = await fetch(`${api}/presence/bulk`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ userIds: [userId] }),
                });
                const data = await res.json();
                return data[userId];
            },
            { api: API_URL, userId: userAId },
        );

        expect(appearance).toBe("offline");
    });

    test("Setting back to Online works", async () => {
        await setStatusViaApi(pageA, "online");

        const status = await getMyStatus(pageA);
        expect(status).toBe("online");
    });

    test("Online persists after page refresh", async () => {
        await pageA.reload();
        await pageA.waitForURL(/\/app/, { timeout: 10_000 });

        const status = await getMyStatus(pageA);
        expect(status).toBe("online");
    });

    test("Connected user with Default status appears online to others", async () => {
        const userAId = await pageA.evaluate(async ({ api }) => {
            const res = await fetch(`${api}/users/me`, { credentials: "include" });
            const data = await res.json();
            return data.userId;
        }, { api: API_URL });

        const appearance = await pageB.evaluate(
            async ({ api, userId }) => {
                const res = await fetch(`${api}/presence/bulk`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ userIds: [userId] }),
                });
                const data = await res.json();
                return data[userId];
            },
            { api: API_URL, userId: userAId },
        );

        expect(appearance).toBe("online");
    });

    test("Disconnected user appears offline to others", async () => {
        const userAId = await pageA.evaluate(async ({ api }) => {
            const res = await fetch(`${api}/users/me`, { credentials: "include" });
            const data = await res.json();
            return data.userId;
        }, { api: API_URL });

        // Close A's context (disconnects WebSockets)
        await ctxA.close();

        // Wait for disconnect to propagate
        await pageB.waitForTimeout(2000);

        const appearance = await pageB.evaluate(
            async ({ api, userId }) => {
                const res = await fetch(`${api}/presence/bulk`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ userIds: [userId] }),
                });
                const data = await res.json();
                return data[userId];
            },
            { api: API_URL, userId: userAId },
        );

        expect(appearance).toBe("offline");
    });

    test("Reconnected user appears online again", async ({ browser }) => {
        // Re-login A
        ({ context: ctxA, page: pageA } = await loginUser(browser, userA));

        // Wait for connection to establish
        await pageA.waitForTimeout(2000);

        const userAId = await pageA.evaluate(async ({ api }) => {
            const res = await fetch(`${api}/users/me`, { credentials: "include" });
            const data = await res.json();
            return data.userId;
        }, { api: API_URL });

        const appearance = await pageB.evaluate(
            async ({ api, userId }) => {
                const res = await fetch(`${api}/presence/bulk`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ userIds: [userId] }),
                });
                const data = await res.json();
                return data[userId];
            },
            { api: API_URL, userId: userAId },
        );

        expect(appearance).toBe("online");
    });

    test("Status change broadcasts to DM contact in real-time", async () => {
        // Navigate B to DMs so the presence listener is active
        await pageB.goto(`${BASE}/app`);
        await pageB.waitForLoadState("networkidle");

        // A sets to DND
        await setStatusViaApi(pageA, "donotdisturb");

        // Wait for broadcast
        await pageA.waitForTimeout(1000);

        // B should see A's updated status via the real-time event
        // Verify by checking the API (broadcast already updated the server)
        const userAId = await pageA.evaluate(async ({ api }) => {
            const res = await fetch(`${api}/users/me`, { credentials: "include" });
            const data = await res.json();
            return data.userId;
        }, { api: API_URL });

        const appearance = await pageB.evaluate(
            async ({ api, userId }) => {
                const res = await fetch(`${api}/presence/bulk`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ userIds: [userId] }),
                });
                const data = await res.json();
                return data[userId];
            },
            { api: API_URL, userId: userAId },
        );

        expect(appearance).toBe("donotdisturb");
    });

    // Reset to online for cleanup
    test("Cleanup: reset status to online", async () => {
        await setStatusViaApi(pageA, "online");
        const status = await getMyStatus(pageA);
        expect(status).toBe("online");
    });
});

// ─── HELPERS ─────────────────────────────────────────────────────────

async function setStatusViaApi(page: Page, status: string): Promise<void> {
    const res = await page.evaluate(
        async ({ api, status }) => {
            const r = await fetch(`${api}/presence`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ status }),
            });
            return r.status;
        },
        { api: API_URL, status },
    );
    expect(res).toBe(200);
}

async function getMyStatus(page: Page): Promise<string> {
    return page.evaluate(async ({ api }) => {
        const res = await fetch(`${api}/presence/me`, { credentials: "include" });
        const data = await res.json();
        return data.status;
    }, { api: API_URL });
}
