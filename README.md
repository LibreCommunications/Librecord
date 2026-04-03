# Librecord

Self-hosted Discord alternative. Messaging, voice/video calls, screen sharing, servers with roles and permissions. Everything encrypted at rest.

Built with .NET 10 and React 19. Licensed under [AGPL-3.0](LICENSE).

## Features

- DMs, group chats, servers with channels, threads, reactions, pins
- Voice and video calls with screen sharing (via LiveKit)
- Roles, permissions, channel-level permission overrides
- Friend requests, blocking, online/idle/DND/invisible status
- Typing indicators, read receipts, unread badges
- Server-side AES-256-GCM message encryption at rest
- File attachments with image/video previews
- Desktop app (Electron), mobile app (planned)

## Development

You need Docker, .NET 10 SDK, Node.js 20+, and pnpm.

```bash
# Start PostgreSQL and MinIO
docker compose up -d postgres minio

# Run database migrations
./ef-migrate.sh --apply-only

# Start the backend
dotnet run --project Librecord.Api

# In another terminal — start the frontend
cd Librecord.Client
pnpm install
pnpm dev
```

The frontend is at `https://localhost:5173`, the API at `https://localhost:5111`.

See [docs/development.md](docs/development.md) for the full setup guide (HTTPS certs, MinIO bucket creation, migrations, troubleshooting).

## Deploying

Fork this repo and deploy from your own GitHub. The included CI pipeline builds, tests, and deploys automatically on push using a self-hosted GitHub Actions runner.

See [docs/deployment/](docs/deployment/) for a full step-by-step guide covering nginx, Docker, SSL, blue-green deployment, and optional LiveKit setup for voice/video.

## Contributing

Open an issue first to discuss what you'd like to change.

## License

[GNU Affero General Public License v3.0](LICENSE)
