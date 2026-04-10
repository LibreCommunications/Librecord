/**
 * Platform dispatcher for screen capture native modules.
 *
 * Each OS owns its own file under platform/. The dispatcher is the
 * single seam main.ts touches; per-platform additions (e.g. macOS
 * ScreenCaptureKit later) just need to add a new module + a case here.
 */

import type { App, BrowserWindow, IpcMain } from "electron";

import { setupLinuxScreenCapture }  from "./linux";
import { setupWindowsScreenCapture } from "./win32";
import { setupDarwinScreenCapture }  from "./darwin";

export function setupPlatformScreenCapture(
    app: App,
    ipcMain: IpcMain,
    getMainWindow: () => BrowserWindow | null,
): void {
    switch (process.platform) {
        case "linux":
            setupLinuxScreenCapture(app, ipcMain, getMainWindow);
            break;
        case "win32":
            setupWindowsScreenCapture(app, ipcMain, getMainWindow);
            break;
        case "darwin":
            setupDarwinScreenCapture(app, ipcMain, getMainWindow);
            break;
    }
}
