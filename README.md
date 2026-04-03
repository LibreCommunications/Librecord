# Librecord

A self-hosted Discord alternative. Real-time messaging, voice and video calls, screen sharing, servers with roles and permissions -- all encrypted at rest. Fork it, deploy it, own your communication.

Built with .NET 10 and React 19. Licensed under [AGPL-3.0](LICENSE).

## Features

- Direct messages, group chats, servers with channels, threads, reactions, and pins
- Voice and video calls with screen sharing (powered by LiveKit)
- Roles, permissions, and per-channel permission overrides
- Friend requests, blocking, and presence (online / idle / DND / invisible)
- Typing indicators, read receipts, and unread badges
- Server-side AES-256-GCM message encryption at rest
- File attachments with image and video previews
- Desktop app (Electron) and mobile app (planned)

## Quick Start

Prerequisites: Docker, .NET 10 SDK, Node.js 20+, and pnpm.

```bash
# Start PostgreSQL and MinIO
docker compose up -d postgres minio

# Run database migrations
./ef-migrate.sh --apply-only

# Start the backend
dotnet run --project Librecord.Api

# In another terminal -- start the frontend
cd Librecord.Client
pnpm install
pnpm dev
```

The frontend runs at `https://localhost:5173` and the API at `https://localhost:5111`.

For the full setup guide (HTTPS certificates, MinIO bucket creation, troubleshooting), see [docs/development.md](docs/development.md).

## Deploying

Fork this repo and deploy from your own GitHub. The included CI pipeline builds, tests, and deploys on push using a self-hosted GitHub Actions runner with zero-downtime blue-green deployment.

See [docs/deployment/](docs/deployment/) for a complete walkthrough covering nginx, Docker, SSL, secrets, and optional LiveKit setup for voice and video.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

## License

[GNU Affero General Public License v3.0](LICENSE)

For organizations that need an alternative to AGPL, commercial licensing is available. Contact [LibreCommunications](https://github.com/LibreCommunications) for details.
