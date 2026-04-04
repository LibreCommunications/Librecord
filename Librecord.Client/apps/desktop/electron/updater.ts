import { app } from "electron";

export function initUpdater() {
  if (!app.isPackaged) return;

  import("electron-updater").then((mod) => {
    const autoUpdater = mod.autoUpdater ?? mod.default?.autoUpdater ?? mod.default;
    if (!autoUpdater) return;

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

    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }).catch(() => {});
}
