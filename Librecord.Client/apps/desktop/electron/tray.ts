import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";
import { join } from "path";

let tray: Tray | null = null;

export function initTray(getWindow: () => BrowserWindow | null) {
  let icon: Electron.NativeImage;

  if (process.platform === "win32") {
    // Windows: use .ico
    icon = nativeImage.createFromPath(join(__dirname, "../build/icons/icon.ico"));
  } else {
    // Linux & macOS: use 32x32 PNG (macOS will auto-template if needed)
    icon = nativeImage.createFromPath(join(__dirname, "../build/icons/32x32.png"));
  }

  // Fallback: resize from SVG if PNGs aren't bundled
  if (icon.isEmpty()) {
    icon = nativeImage
      .createFromPath(join(__dirname, "../dist/librecord.svg"))
      .resize({ width: 24, height: 24 });
  }

  tray = new Tray(icon);
  tray.setToolTip("Librecord");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Librecord",
      click: () => {
        const win = getWindow();
        if (win) {
          win.show();
          win.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        // Use app.quit() instead of app.exit(0) so the before-quit
        // handler runs and cleans up voice/capture sessions gracefully.
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    const win = getWindow();
    if (win) {
      if (win.isVisible()) {
        win.focus();
      } else {
        win.show();
        win.focus();
      }
    }
  });
}

export function destroyTray() {
  tray?.destroy();
  tray = null;
}
