# Librecord

A free, open-source alternative to Discord. Real-time messaging, voice and video calls, screen sharing — all self-hosted.

## What it does

- **Messaging** — DMs, group chats, and server channels with threads, reactions, and pins
- **Voice & Video** — Calls with screen sharing
- **Servers** — Create communities with channels, roles, and permissions
- **Friends** — Friend requests, blocking, online status
- **Privacy** — Messages are encrypted at rest on the server
- **Notifications** — Typing indicators, read receipts, unread badges, desktop notifications
- **Cross-platform** — Web app, desktop app (Electron), mobile app (planned)

## Quick Start

```bash
# One-command setup (requires Docker, .NET 10 SDK, Node.js 20+, pnpm)
./setup-dev.sh

# Start backend
dotnet run --project Librecord.Api

# Start frontend (separate terminal)
cd Librecord.Client && pnpm dev
```

See [DEV_SETUP.md](DEV_SETUP.md) for detailed setup instructions.

## Screenshots

*Coming soon*

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
