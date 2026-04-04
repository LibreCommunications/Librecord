import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";
import { join } from "path";

let tray: Tray | null = null;

export function initTray(getWindow: () => BrowserWindow | null) {
  const iconPath = join(__dirname, "../dist/librecord.svg");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 24, height: 24 });

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
        app.exit(0);
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
