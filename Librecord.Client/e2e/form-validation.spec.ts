import { test, expect } from "@playwright/test";
import { BASE } from "./helpers";

/**
 * E2E tests for client-side form validation:
 * - Login form requires both fields
 * - Register form requires email, username, password with length constraints
 */

test.describe("Form validation", () => {
    test("Login — empty form shows validation", async ({ browser }) => {
        const context = await browser.newContext({ ignoreHTTPSErrors: true });
        const page = await context.newPage();

        await page.goto(`${BASE}/login`);
        await page.waitForLoadState("networkidle");

        // Both inputs should have required attribute
        const emailInput = page.locator("input[type='text']");
        const passwordInput = page.locator("input[type='password']");
        await expect(emailInput).toHaveAttribute("required", "");
        await expect(passwordInput).toHaveAttribute("required", "");

        await context.close();
    });

    test("Register — inputs have required and length constraints", async ({ browser }) => {
        const context = await browser.newContext({ ignoreHTTPSErrors: true });
        const page = await context.newPage();

        await page.goto(`${BASE}/register`);
        await page.waitForLoadState("networkidle");

        const inputs = page.locator("input");

        // Email — required
        const emailInput = inputs.nth(0);
        await expect(emailInput).toHaveAttribute("type", "email");
        await expect(emailInput).toHaveAttribute("required", "");

        // Username — required, minLength=3, maxLength=32
        const usernameInput = inputs.nth(1);
        await expect(usernameInput).toHaveAttribute("required", "");
        await expect(usernameInput).toHaveAttribute("minLength", "3");
        await expect(usernameInput).toHaveAttribute("maxLength", "32");

        // Password — required, minLength=6
        const passwordInput = inputs.nth(3);
        await expect(passwordInput).toHaveAttribute("type", "password");
        await expect(passwordInput).toHaveAttribute("required", "");
        await expect(passwordInput).toHaveAttribute("minLength", "6");

        await context.close();
    });
});
