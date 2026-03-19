import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    retries: 0,
    workers: 1,
    timeout: 120_000,
    expect: { timeout: 15_000 },

    use: {
        baseURL: "https://localhost:5173",
        ignoreHTTPSErrors: true,
        video: "retain-on-failure",
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
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
