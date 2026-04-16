# Changelog

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
