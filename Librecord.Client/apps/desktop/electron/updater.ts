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
 * ── Race fix: pendingVersion cache ────────────────────────────
 * `update-downloaded` can fire before the renderer has registered its
 * IPC listener (downloads often finish within a second of app start,
 * renderer is still parsing lazy chunks). `webContents.send()` is
 * fire-and-forget — an unlistened message is lost forever.
 *
 * We cache the last "update-downloaded" version here, expose it via
 * `desktop:getPendingUpdate`, and the renderer queries it on mount.
 * This makes the flow idempotent regardless of event timing.
 *
 * In dev (!app.isPackaged) the whole module is a no-op — electron-updater
 * needs a packaged app to verify update signatures. To test the update UI
 * in dev, package the app once and run from `release/`.
 */

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

let pendingVersion: string | null = null;
let lastError: string | null = null;

export function initUpdater(getMainWindow: () => BrowserWindow | null) {
  // Always register IPC handlers — even in dev — so the renderer never
  // hits "No handler registered" exceptions when probing for updates.
  ipcMain.handle("desktop:getPendingUpdate", () => pendingVersion);
  ipcMain.handle("desktop:getUpdateError", () => lastError);

  if (!app.isPackaged) {
    // Still register installUpdateNow + checkForUpdate so the renderer
    // code path is identical in dev; they're just no-ops.
    ipcMain.handle("desktop:installUpdateNow", () => { /* dev no-op */ });
    ipcMain.handle("desktop:checkForUpdate", () => ({ ok: false, reason: "not packaged (dev build)" }));
    return;
  }

  import("electron-updater")
    .then((mod) => {
      // electron-updater's CJS/ESM interop is messy depending on the
      // bundler — try every shape we've seen.
      const autoUpdater = mod.autoUpdater ?? mod.default?.autoUpdater ?? mod.default;
      if (!autoUpdater) {
        console.warn("[updater] no autoUpdater export found");
        lastError = "electron-updater: no autoUpdater export found";
        return;
      }

      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      // Verbose logging so issues are diagnosable from the terminal
      // (or packaged log file if electron-log is wired up later).
      autoUpdater.logger = console;

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
        pendingVersion = info.version;
        lastError = null;

        // Fire-and-forget — renderer picks it up either via this event
        // (if its listener is live) or via desktop:getPendingUpdate
        // (if it mounts after the event fires). Both paths are safe.
        const mw = getMainWindow();
        if (mw && !mw.isDestroyed()) {
          try {
            mw.webContents.send("update-downloaded", info.version);
          } catch (e) {
            console.warn("[updater] failed to forward update-downloaded:", e);
          }
        }
      });

      autoUpdater.on("error", (err: Error) => {
        console.error("[updater] error:", err.message);
        lastError = err.message;
      });

      // Renderer-triggered "Restart now". With the assisted NSIS installer
      // (oneClick: false), isSilent must be false so the installer can
      // upgrade an existing install in place. isForceRunAfter re-launches
      // the app after a successful install.
      ipcMain.handle("desktop:installUpdateNow", () => {
        console.log("[updater] installing update via renderer request");
        autoUpdater.quitAndInstall(false, true);
      });

      // Manual check from settings page — returns a result the renderer
      // can surface to the user ("no updates", "update ready", "error").
      ipcMain.handle("desktop:checkForUpdate", async () => {
        try {
          const result = await autoUpdater.checkForUpdates();
          const version = result?.updateInfo?.version;
          if (!version) return { ok: true, hasUpdate: false };
          return {
            ok: true,
            hasUpdate: version !== app.getVersion(),
            version,
            downloaded: pendingVersion === version,
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          lastError = msg;
          return { ok: false, reason: msg };
        }
      });

      // First check immediately so users see updates as soon as the app
      // is open; subsequent checks every CHECK_INTERVAL_MS.
      const check = () => {
        autoUpdater
          .checkForUpdates()
          .catch((e: Error) => {
            console.error("[updater] checkForUpdates failed:", e.message);
            lastError = e.message;
          });
      };
      check();
      setInterval(check, CHECK_INTERVAL_MS);
    })
    .catch((e) => {
      console.warn("[updater] import failed:", e?.message ?? e);
      lastError = `electron-updater import failed: ${e?.message ?? e}`;
    });
}
