// Electron renderer is Chromium — re-export web platform by default.
// Override specific services as needed (e.g., native notifications, electron-store).
export { WebPlatformProvider as ElectronPlatformProvider } from "@librecord/platform-web";
