import { app } from "electron";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

function getAutostartDir(): string {
  return join(app.getPath("appData"), "..", "autostart");
}

function getDesktopFilePath(): string {
  return join(getAutostartDir(), "com.librecord.desktop.desktop");
}

function getAppImagePath(): string | null {
  return process.env.APPIMAGE || null;
}

export function isAutostartEnabled(): boolean {
  return existsSync(getDesktopFilePath());
}

export function setAutostart(enabled: boolean): boolean {
  const filePath = getDesktopFilePath();

  if (enabled) {
    const execPath = getAppImagePath() || process.execPath;
    const content = `[Desktop Entry]
Name=Librecord
Comment=Self-hosted chat, voice, and video
Exec="${execPath}" --hidden
Icon=com.librecord.desktop
Type=Application
Terminal=false
Categories=Network;Chat;InstantMessaging;
StartupWMClass=Librecord
X-GNOME-Autostart-enabled=true
`;

    const dir = getAutostartDir();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, content, "utf-8");
    return true;
  } else {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    return false;
  }
}
