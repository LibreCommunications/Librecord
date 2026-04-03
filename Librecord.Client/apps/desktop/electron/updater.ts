import { app } from "electron";

export function initUpdater() {
  if (!app.isPackaged) return;

  try {
    // Dynamic import to avoid CJS/ESM issues in dev
    import("electron-updater").then(({ autoUpdater }) => {
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;

      autoUpdater.on("update-available", (info: { version: string }) => {
        console.log("Update available:", info.version);
      });

      autoUpdater.on("update-downloaded", (info: { version: string }) => {
        console.log("Update downloaded:", info.version, "- will install on quit");
      });

      autoUpdater.on("error", (err: Error) => {
        console.error("Auto-update error:", err.message);
      });

      autoUpdater.checkForUpdatesAndNotify();
    });
  } catch {
    // electron-updater not available in dev
  }
}
