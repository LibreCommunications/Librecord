import { defineConfig } from "@playwright/test";

/**
 * Environment-driven config:
 *   E2E_BASE_URL  — frontend URL  (default: https://localhost:5173)
 *   E2E_API_URL   — backend URL   (default: https://localhost:5111)
 *
 * Run against production:
 *   E2E_BASE_URL=https://librecord.gros-sans-dessein.com \
 *   E2E_API_URL=https://librecord.gros-sans-dessein.com/api \
 *   npm run test:e2e
 */
export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    retries: 0,
    workers: 1,
    timeout: 120_000,
    expect: { timeout: 15_000 },

    use: {
        baseURL: process.env.E2E_BASE_URL ?? "https://localhost:5173",
        ignoreHTTPSErrors: true,
        video: "retain-on-failure",
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
        viewport: { width: 1920, height: 1080 },
    },

    projects: [
        {
            name: "chromium",
            use: {
                channel: "chromium",
                launchOptions: {
                    args: [
                        "--use-fake-ui-for-media-stream",
                        "--use-fake-device-for-media-stream",
                        "--auto-select-desktop-capture-source=Entire screen",
                        "--disable-web-security",
                        "--allow-running-insecure-content",
                        "--autoplay-policy=no-user-gesture-required",
                    ],
                },
                permissions: ["camera", "microphone"],
                contextOptions: {
                    ignoreHTTPSErrors: true,
                },
            },
        },
    ],
});
