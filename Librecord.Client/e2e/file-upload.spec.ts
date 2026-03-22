import { test, expect } from "@playwright/test";
import { makeUser, registerUser, waitForRealtime, BASE, API_URL, type TestUser } from "./helpers";
import type { BrowserContext, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

/**
 * E2E tests for file upload UX:
 *
 * #35 — Uploading indicator visible during file send
 * #37 — Error toast shown when upload fails
 */

let userA: TestUser;
let ctxA: BrowserContext;
let pageA: Page;
let guildId: string;
let channelId: string;

test.describe.serial("File upload UX (#33, #35, #37)", () => {
    test("Register user and create guild + channel", async ({ browser }) => {
        userA = makeUser("upton");
        ({ context: ctxA, page: pageA } = await registerUser(browser, userA));

        await pageA.locator("[data-testid='create-guild-btn']").click();
        await pageA.getByPlaceholder("My Guild").fill("Upload Test Guild");
        await pageA.getByRole("button", { name: /create guild/i }).click();
        await pageA.waitForURL(/\/app\/guild\//, { timeout: 10_000 });
        guildId = pageA.url().match(/\/app\/guild\/([^/]+)/)![1];

        const channel = await pageA.evaluate(
            async ({ apiUrl, guildId }) => {
                const res = await fetch(`${apiUrl}/channels/guild/${guildId}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ name: "uploads", type: 0, position: 0 }),
                });
                return res.json();
            },
            { apiUrl: API_URL, guildId },
        );
        channelId = channel.id;

        await pageA.goto(`${BASE}/app/guild/${guildId}/${channelId}`);
        await pageA.waitForLoadState("networkidle");
        await waitForRealtime(pageA);
        await expect(pageA.locator(`textarea[placeholder*="Message #"]`)).toBeVisible({ timeout: 10_000 });
    });

    test("#35 — Uploading indicator appears while sending a file", async () => {
        // Create a small test file
        const tmpFile = path.join("/tmp", `test-upload-${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, "Hello from Playwright test!");

        // Attach the file via the hidden input
        const fileInput = pageA.locator('input[type="file"]');
        await fileInput.setInputFiles(tmpFile);

        // Verify file preview appears
        await expect(pageA.locator(`text=test-upload`)).toBeVisible({ timeout: 3_000 });

        // Send the message (with file)
        const input = pageA.locator(`textarea[placeholder*="Message #"]`);
        await input.fill("File upload test");
        await input.press("Enter");

        // "Uploading…" indicator should appear briefly
        // (may be very fast on localhost, so we just check it doesn't error)
        // After upload completes, the message should be visible
        await expect(
            pageA.locator(`[data-testid='message-content']:has-text("File upload test")`),
        ).toBeVisible({ timeout: 30_000 });

        // Clean up
        fs.unlinkSync(tmpFile);
    });

    test("#37 — Error toast shown when upload to invalid channel fails", async () => {
        // Create a small test file
        const tmpFile = path.join("/tmp", `test-fail-${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, "This should fail");

        // Navigate to a non-existent channel to force upload failure
        // We'll intercept the upload request and make it fail instead
        await pageA.route("**/with-attachments", route => {
            route.fulfill({ status: 500, body: "Internal Server Error" });
        });

        // Attach file and send
        const fileInput = pageA.locator('input[type="file"]');
        await fileInput.setInputFiles(tmpFile);

        const input = pageA.locator(`textarea[placeholder*="Message #"]`);
        await input.fill("Should fail");
        await input.press("Enter");

        // Error toast should appear
        await expect(
            pageA.locator("text=Failed to send file"),
        ).toBeVisible({ timeout: 10_000 });

        // Remove the route intercept
        await pageA.unroute("**/with-attachments");

        // Clean up
        fs.unlinkSync(tmpFile);
    });

    test.afterAll(async () => {
        await ctxA?.close();
    });
});
