import { autoUpdater } from "electron-updater";
import { app } from "electron";

export function initUpdater() {
  // Don't check for updates in dev
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    console.log("Update available:", info.version);
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("Update downloaded:", info.version, "— will install on quit");
  });

  autoUpdater.on("error", (err) => {
    console.error("Auto-update error:", err.message);
  });

  autoUpdater.checkForUpdatesAndNotify();
}
