import { app, BrowserWindow, ipcMain } from "electron";

/**
 * Update flow:
 *   1. Check immediately at startup, then every CHECK_INTERVAL_MS.
 *   2. electron-updater downloads the update in the background
 *      (`autoDownload = true`) and emits `update-downloaded`.
 *   3. We forward `update-downloaded` to the renderer, which shows a modal
 *      ("Update ready. Restart now?").
 *   4. The renderer button calls `desktop:installUpdateNow` →
 *      `quitAndInstall()`, which closes the app and re-launches into the
 *      new version.
 *   5. If the user dismisses the modal, `autoInstallOnAppQuit = true`
 *      installs the update next time they manually quit anyway.
 *
 * In dev (!app.isPackaged) the whole module is a no-op — electron-updater
 * needs a packaged app to verify update signatures. To test the update UI
 * in dev, package the app once and run from `release/`.
 */

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function initUpdater(getMainWindow: () => BrowserWindow | null) {
  if (!app.isPackaged) return;

  import("electron-updater")
    .then((mod) => {
      // electron-updater's CJS/ESM interop is messy depending on the
      // bundler — try every shape we've seen.
      const autoUpdater = mod.autoUpdater ?? mod.default?.autoUpdater ?? mod.default;
      if (!autoUpdater) {
        console.warn("electron-updater: no autoUpdater export found");
        return;
      }

      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;

      autoUpdater.on("checking-for-update", () => {
        console.log("[updater] checking for updates");
      });

      autoUpdater.on("update-available", (info: { version: string }) => {
        console.log("[updater] update available:", info.version);
        // Renderer doesn't need to act on this — wait for download to
        // finish before prompting the user.
      });

      autoUpdater.on("update-not-available", () => {
        console.log("[updater] no update available");
      });

      autoUpdater.on("download-progress", (p: { percent: number; bytesPerSecond: number }) => {
        console.log(
          `[updater] downloading: ${p.percent.toFixed(1)}% @ ${(p.bytesPerSecond / 1024).toFixed(0)} KB/s`,
        );
      });

      autoUpdater.on("update-downloaded", (info: { version: string }) => {
        console.log("[updater] update downloaded:", info.version);
        getMainWindow()?.webContents.send("update-downloaded", info.version);
      });

      autoUpdater.on("error", (err: Error) => {
        console.error("[updater] error:", err.message);
      });

      // Renderer-triggered "Restart now". With the assisted NSIS installer
      // (oneClick: false), isSilent must be false so the installer can
      // upgrade an existing install in place. isForceRunAfter re-launches
      // the app after a successful install.
      ipcMain.handle("desktop:installUpdateNow", () => {
        console.log("[updater] installing update via renderer request");
        autoUpdater.quitAndInstall(false, true);
      });

      // First check immediately so users see updates as soon as the app
      // is open; subsequent checks every CHECK_INTERVAL_MS.
      const check = () => {
        autoUpdater
          .checkForUpdates()
          .catch((e: Error) => console.error("[updater] checkForUpdates failed:", e.message));
      };
      check();
      setInterval(check, CHECK_INTERVAL_MS);
    })
    .catch((e) => {
      console.warn("electron-updater: import failed:", e?.message ?? e);
    });
}
