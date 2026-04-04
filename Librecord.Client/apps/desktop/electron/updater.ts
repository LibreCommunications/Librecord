import { app, BrowserWindow, Notification } from "electron";
import { join } from "path";

export function initUpdater(getMainWindow: () => BrowserWindow | null) {
  if (!app.isPackaged) return;

  import("electron-updater").then((mod) => {
    const autoUpdater = mod.autoUpdater ?? mod.default?.autoUpdater ?? mod.default;
    if (!autoUpdater) return;

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("update-available", (info: { version: string }) => {
      console.log("Update available:", info.version);
      getMainWindow()?.webContents.send("update-available", info.version);
    });

    autoUpdater.on("update-downloaded", (info: { version: string }) => {
      console.log("Update downloaded:", info.version, "- will install on quit");
      getMainWindow()?.webContents.send("update-downloaded", info.version);

      const iconPath = join(__dirname, "../build/icons/256x256.png");
      const notification = new Notification({
        title: "Update Ready",
        body: `Librecord v${info.version} has been downloaded and will be installed on restart.`,
        icon: iconPath,
      });
      notification.on("click", () => {
        const win = getMainWindow();
        if (win) {
          win.show();
          win.focus();
        }
      });
      notification.show();
    });

    autoUpdater.on("error", (err: Error) => {
      console.error("Auto-update error:", err.message);
    });

    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }).catch(() => {});
}
