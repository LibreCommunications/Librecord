# Changelog

## 0.1.18 — 2026-04-12

### New
- **Two-factor authentication** — Secure your account with TOTP-based 2FA. Set up via Settings > Security.
- **Email verification** — New accounts must verify their email. Existing accounts get a grace period.
- **Recovery codes** — 10 one-time codes generated when enabling 2FA, with option to regenerate.
- **Security settings page** — New dedicated page for managing 2FA and email verification.

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
