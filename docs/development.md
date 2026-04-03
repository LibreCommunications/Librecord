# Local Development Setup

How to get Librecord running on your machine.

## Prerequisites

- **Docker** — for PostgreSQL and MinIO
- **.NET 10 SDK** — [install instructions](https://dotnet.microsoft.com/download)
- **EF Core tools** — `dotnet tool install --global dotnet-ef`
- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **pnpm** — `npm i -g pnpm`

## 1. Clone and enter the repo

```bash
git clone https://github.com/LibreCommunications/Librecord.git
cd Librecord
```

## 2. Start PostgreSQL and MinIO

```bash
docker compose up -d postgres minio
```

This starts:
- **PostgreSQL** on `localhost:5432` (user: `dev`, password: `devpass`, database: `librecord`)
- **MinIO** on `localhost:9000` (console at `localhost:9001`, credentials: `minioadmin`/`minioadmin`)

These match the defaults in `appsettings.Development.json` — no config needed.

## 3. Create the MinIO bucket

First time only. Open `http://localhost:9001` in your browser, log in with `minioadmin`/`minioadmin`, and create a bucket called `librecord-attachments`.

Or via CLI:

```bash
# Install mc (MinIO client) if you don't have it
# https://min.io/docs/minio/linux/reference/minio-mc.html

mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/librecord-attachments
mc anonymous set download local/librecord-attachments/avatars
mc anonymous set download local/librecord-attachments/guild-icons
mc anonymous set download local/librecord-attachments/banners
mc anonymous set download local/librecord-attachments/thumbnails
mc anonymous set download local/librecord-attachments/emojis
```

## 4. Generate HTTPS certificates

The backend and frontend both use HTTPS locally. Generate a self-signed cert:

```bash
dotnet dev-certs https --export-path ~/.aspnet/https/localhost.pem --format Pem --no-password
```

If you're on Linux and your browser doesn't trust it, you may need to add it manually or just accept the warning.

## 5. Run database migrations

```bash
./ef-migrate.sh --apply-only
```

This applies all existing migrations to your local PostgreSQL. First time it creates all the tables.

To create a new migration after changing entities:

```bash
./ef-migrate.sh
# It will prompt you for a migration name
```

## 6. Start the backend

```bash
dotnet run --project Librecord.Api
```

The API runs at `https://localhost:5111`. You can verify it's working:

```bash
curl -k https://localhost:5111/health
```

## 7. Start the frontend

```bash
cd Librecord.Client
pnpm install
pnpm dev
```

Opens at `https://localhost:5173`. The `.env` file is already set up to point at the local backend.

## 8. Voice/Video (optional)

Voice and video calls need a LiveKit server. For local dev:

```bash
docker compose --profile livekit up -d livekit
```

This requires a `livekit.yaml` config file — see [docs/deployment/livekit.md](deployment/livekit.md). For local dev you can skip this; everything else works without it.

## Project layout

```
Librecord.Api/            .NET API server (controllers, SignalR hubs)
Librecord.Application/    Business logic (services)
Librecord.Domain/         Entities and interfaces
Librecord.Infra/          Database, repositories, encryption
Librecord.Tests/          Unit tests (xUnit)
Librecord.Client/         Frontend monorepo
  apps/web/               Vite web app entry point
  apps/desktop/           Electron desktop app
  packages/domain/        Shared TypeScript types
  packages/api-client/    HTTP + SignalR client
  packages/app/           React hooks, state, voice
  packages/platform/      Platform abstraction interfaces
  packages/platform-web/  Browser implementations
  packages/ui-web/        React components and pages
  packages/design/        Tailwind CSS and styles
```

## Useful commands

```bash
# Backend
dotnet build Librecord.sln          # Build everything
dotnet test Librecord.Tests         # Run unit tests
dotnet run --project Librecord.Api  # Run API server

# Frontend (from Librecord.Client/)
pnpm dev                            # Web dev server
pnpm build                          # Production build
pnpm dev:desktop                    # Electron dev mode
pnpm lint                           # ESLint

# Database
./ef-migrate.sh                     # Create + apply migration (interactive)
./ef-migrate.sh --apply-only        # Apply existing migrations

# Docker
docker compose up -d postgres minio                   # Start infra
docker compose --profile livekit up -d livekit        # Start LiveKit
docker compose down                                    # Stop everything
```

## Troubleshooting

**"Connection refused" on the frontend** — Make sure the backend is running and the `.env` in `Librecord.Client/` has `VITE_API_URL=https://localhost:5111`.

**Database migration fails** — Check that PostgreSQL is running: `docker compose ps`. If the schema is out of sync, the migration script offers to drop and recreate the database.

**HTTPS certificate errors** — Run `dotnet dev-certs https --trust` (macOS/Windows) or accept the browser warning (Linux).

**MinIO "bucket not found"** — Make sure you created the bucket (step 3).
