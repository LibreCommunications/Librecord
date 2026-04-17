# Changelog

## 0.1.27 — 2026-04-16

### Fixed
- Video attachments: `<video>` element now correctly loads a first-frame thumbnail in the packaged desktop app (the previous black rectangle was caused by `preload="metadata"` interacting badly with cross-origin cookies in dev-mode Electron).
- Nginx MinIO proxy: stream byte-ranges straight through (`proxy_buffering off`) instead of buffering entire files — fixes video seek and metadata preload timeouts.
- Nginx CORS on `/storage/` redirect target so `<video crossorigin="use-credentials">` can authorize on the redirect hop.
- Added dedicated `/api/cdn/private/` nginx location with a much higher rate-limit burst (300 vs 60) so scrolling a chat with many attachments doesn't trip 429s on lazy-loaded images and video metadata preloads.
- Per-user-CDN dotnet rate-limit policy bumped (1200/min) on `PrivateCdnController`.

### Changed
- Windows audio: renamed internal native module `@librecord/wincap` → `@librecord/winaudio` (v0.4.0). ~3,000 lines of unused video-capture code removed. The desktop's screenshare video path uses Chromium's native `getDisplayMedia` now; the native module only provides WASAPI process-loopback audio (for echo-free screen sharing).

---

## 0.1.26 — 2026-04-16

### New
- Noise suppression now runs in a dedicated Web Worker with a direct `MessagePort` to the audio thread, eliminating main-thread WASM hops. Fixes "robotic voice" artifacts some users heard during React renders / GC pauses.

### Fixed
- RNNoise auto-mode survives LiveKit reconnects cleanly — the mic no longer goes silent on remote listeners after a voice reconnect with noise suppression enabled.
- Screenshare on Windows: switched to a hybrid "Chromium video + winaudio audio" pipeline. Single hardware H.264 encode (no more double-encode) dramatically improves quality and reduces GPU contention during games.
- Screenshare autostart: captures stop cleanly when the shared app/window is closed (no more orphan audio streams).
- `maintain-framerate` + `contentHint: motion` for screenshare so high-motion content (games) stays smooth under bandwidth pressure instead of oscillating FPS.

### Internal
- Added `rnnoiseWorker.ts` + `MessageChannel` wiring between the AudioWorklet and the worker.

---

## 0.1.25 — 2026-04-16

### Fixed
- Global sidebar (server list) no longer overflows or shows a scrollbar; strictly clipped to its 72px width.

---

## 0.1.24 — 2026-04-16

### Fixed
- **Windows auto-updates** — restored the assisted NSIS installer (`oneClick: false`). The 0.1.21 switch to silent `oneClick` + `perMachine: false` broke auto-updates for users on 0.1.20 and earlier (the silent installer landed in `%LOCALAPPDATA%` instead of upgrading the Program Files install, so shortcuts kept launching the old exe).
- Added `verifyUpdateCodeSignature: false` so unsigned updates aren't silently rejected during Chromium's verification step.
- Updater flow now uses `quitAndInstall(false, true)` — assisted installer UI is visible during the upgrade, as it should be.

### Note
- Users still stuck on 0.1.20 (or earlier) need to manually download 0.1.24+ once. After that, all future updates auto-apply.

---

## 0.1.23 — 2026-04-16

### Fixed
- **Screenshare audio leak (#128)** — viewers no longer hear the stream's system audio before clicking "Watch". Screen share tracks are now proactively unsubscribed on publish; the user opts in explicitly.
- **Register page grey screen on Desktop (#132)** — `<a href="/register">` replaced with React Router `<Link>`; the `file://` SPA no longer tries to navigate to `file:///register` and crash.
- **DOM insertBefore error (#134)** — toast dismiss race with React reconciliation fixed via timer-tracking cleanup.
- **Password requirements hidden (#133)** — registration now shows "Must be between 8 and 128 characters"; frontend `minLength` matches the backend's 8-char minimum.
- **Desktop + Web call conflict (#126)** — accepting or declining a call on one device now dismisses the incoming call modal on the user's other devices via a new `dm:call:answered` signal.
- **Linux auto-updates** — GitHub Actions now generates `latest-linux.yml` alongside the AppImage so electron-updater actually works on Linux.

### Internal
- wincap (now winaudio): idle-repeat frame timer so static screens keep producing keyframes for late joiners.

---

## 0.1.22 — 2026-04-13

### Fixed
- Desktop app: Librecord logo now displays on the login and register pages (was broken on file:// protocol).

---

## 0.1.21 — 2026-04-13

### Fixed
- Desktop app: changelog page now displays correctly (was blank due to file:// fetch failure).
- Windows installer: auto-updates now install silently to a fixed per-user path, so pinned shortcuts from Start Menu and Desktop survive updates.

---

## 0.1.20 — 2026-04-13

### Fixed
- Desktop app: settings navigation from the sidebar avatar now correctly opens the Security tab when 2FA is disabled (previously redirected to DMs due to missing route).

---

## 0.1.19 — 2026-04-13

### New
- **Account recovery codes** — 8 one-time codes generated at registration for password recovery. No email or SMS needed — use a code to reset your password if you forget it.
- **Forgot password flow** — New "Forgot password?" option on the login page lets you reset your password with a recovery code.
- **2FA nudges** — Warning badge on sidebar avatar, settings nav, and a banner on the Security page when 2FA is not enabled.

### Improved
- 2FA login input now uses individual digit boxes with auto-advance, backspace navigation, and paste support.
- Recovery codes can be downloaded as a .txt file or copied to clipboard at registration and from settings.

### Removed
- Email verification — replaced by recovery codes for a fully self-hosted setup with no mail server dependency.

---

## 0.1.18 — 2026-04-12

### New
- **Two-factor authentication** — Secure your account with TOTP-based 2FA. Set up via Settings > Security.
- **Recovery codes** — 10 one-time codes generated when enabling 2FA, with option to regenerate.
- **Security settings page** — New dedicated page for managing 2FA.

### Improved
- Login flow now supports two-step authentication with TOTP or recovery code entry.

---

## 0.1.17 — 2026-04-10

### Fixed
- Echo-free audio during screen share using process loopback capture.
- Stale voice states are now cleaned up on server restart.
- Crash dialog no longer appears on force-quit during screen share (Electron).

---

## 0.1.16 — 2026-04-05

### New
- Initial release of Librecord.
- Real-time messaging with SignalR.
- Voice and video calls via LiveKit.
- Servers with roles and channel permissions.
- Direct messages with end-to-end at-rest encryption.
- Friend system with mutual friends visibility.
- File attachments via MinIO storage.
- Desktop app via Electron.
