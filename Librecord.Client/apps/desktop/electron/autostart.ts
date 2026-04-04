import { app } from "electron";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

// --- Platform-specific paths ---

function getLinuxDesktopFilePath(): string {
  return join(app.getPath("appData"), "autostart", "com.librecord.desktop.desktop");
}

function getWindowsRegistryKey(): string {
  return "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
}

function getMacPlistPath(): string {
  return join(app.getPath("home"), "Library", "LaunchAgents", "com.librecord.desktop.plist");
}

function getExecPath(): string {
  return process.env.APPIMAGE || process.execPath;
}

// --- Linux ---

function isLinuxAutostartEnabled(): boolean {
  return existsSync(getLinuxDesktopFilePath());
}

function setLinuxAutostart(enabled: boolean): boolean {
  const filePath = getLinuxDesktopFilePath();
  if (enabled) {
    const execPath = getExecPath();
    const content = `[Desktop Entry]
Name=Librecord
Comment=Self-hosted chat, voice, and video
Exec="${execPath}" --hidden
Icon=librecord
Type=Application
Terminal=false
Categories=Network;Chat;InstantMessaging;
StartupWMClass=Librecord
X-GNOME-Autostart-enabled=true
`;
    const dir = join(filePath, "..");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, content, "utf-8");
    return true;
  } else {
    if (existsSync(filePath)) unlinkSync(filePath);
    return false;
  }
}

// --- Windows ---

function isWindowsAutostartEnabled(): boolean {
  try {
    const result = execSync(
      `reg query "${getWindowsRegistryKey()}" /v Librecord`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );
    return result.includes("Librecord");
  } catch {
    return false;
  }
}

function setWindowsAutostart(enabled: boolean): boolean {
  const key = getWindowsRegistryKey();
  if (enabled) {
    const execPath = getExecPath();
    execSync(`reg add "${key}" /v Librecord /t REG_SZ /d "\\"${execPath}\\" --hidden" /f`, {
      stdio: "pipe",
    });
    return true;
  } else {
    try {
      execSync(`reg delete "${key}" /v Librecord /f`, { stdio: "pipe" });
    } catch { /* key may not exist */ }
    return false;
  }
}

// --- macOS ---

function isMacAutostartEnabled(): boolean {
  return existsSync(getMacPlistPath());
}

function setMacAutostart(enabled: boolean): boolean {
  const plistPath = getMacPlistPath();
  if (enabled) {
    const execPath = getExecPath();
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.librecord.desktop</string>
  <key>ProgramArguments</key>
  <array>
    <string>${execPath}</string>
    <string>--hidden</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
`;
    const dir = join(plistPath, "..");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(plistPath, content, "utf-8");
    return true;
  } else {
    if (existsSync(plistPath)) unlinkSync(plistPath);
    return false;
  }
}

// --- Public API ---

export function isAutostartEnabled(): boolean {
  switch (process.platform) {
    case "linux": return isLinuxAutostartEnabled();
    case "win32": return isWindowsAutostartEnabled();
    case "darwin": return isMacAutostartEnabled();
    default: return false;
  }
}

export function setAutostart(enabled: boolean): boolean {
  switch (process.platform) {
    case "linux": return setLinuxAutostart(enabled);
    case "win32": return setWindowsAutostart(enabled);
    case "darwin": return setMacAutostart(enabled);
    default: return false;
  }
}
