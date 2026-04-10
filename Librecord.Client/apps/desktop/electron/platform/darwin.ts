/**
 * macOS screen capture platform stub.
 *
 * No native module yet — macOS uses the desktopCapturer fallback path
 * set up in main.ts (setDisplayMediaRequestHandler). This file exists
 * so the platform dispatcher has a symmetric per-OS surface.
 */

import type { App, BrowserWindow, IpcMain } from "electron";

export function setupDarwinScreenCapture(
    _app: App,
    _ipcMain: IpcMain,
    _getMainWindow: () => BrowserWindow | null,
): void {
    // intentionally empty
}
