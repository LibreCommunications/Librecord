# Local Development Setup

How to get Librecord running on your machine for development.

> [!WARNING]
> This documentation was written after the fact and may not be fully accurate. This is a solo project - if something doesn't work, please open an issue and be patient.

## Prerequisites

- **Docker** -- runs PostgreSQL and MinIO
- **.NET 10 SDK** -- [install instructions](https://dotnet.microsoft.com/download)
- **EF Core tools** -- `dotnet tool install --global dotnet-ef`
- **Node.js 20+** -- [nodejs.org](https://nodejs.org)
- **pnpm** -- `npm i -g pnpm`

## 1. Clone the repository

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
- **MinIO** on `localhost:9000` (console at `localhost:9001`, credentials: `minioadmin` / `minioadmin`)

These match the defaults in `appsettings.Development.json` -- no extra configuration needed.

## 3. Create the MinIO bucket

This is a one-time step. Open `http://localhost:9001`, log in with `minioadmin` / `minioadmin`, and create a bucket called `librecord-attachments`.

Or use the MinIO CLI:

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

Both the backend and frontend use HTTPS in development. Generate a self-signed certificate:

```bash
dotnet dev-certs https --export-path ~/.aspnet/https/localhost.pem --format Pem --no-password
```

> [!NOTE]
> On Linux, browsers may not trust the self-signed certificate automatically. You can add it to your system trust store or accept the browser warning.

## 5. Run database migrations

```bash
./ef-migrate.sh --apply-only
```

This applies all existing migrations to your local PostgreSQL instance. On first run, it creates the full schema.

To create a new migration after changing entities:

```bash
./ef-migrate.sh
# The script will prompt you for a migration name
```

## 6. Start the backend

```bash
dotnet run --project Librecord.Api
```

The API runs at `https://localhost:5111`. Verify it's working:

```bash
curl -k https://localhost:5111/health
```

## 7. Start the frontend

```bash
cd Librecord.Client
pnpm install
pnpm dev
```

The frontend runs at `https://localhost:5173`. The `.env` file is pre-configured to point at the local backend.

## 8. Voice and video (optional)

Voice and video calls require a LiveKit server. For local development:

```bash
docker compose --profile livekit up -d livekit
```

This requires a `livekit.yaml` config file. See [deployment/livekit.md](deployment/livekit.md) for details.

> [!TIP]
> You can skip LiveKit entirely for local development. All other features work without it.

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

**"Connection refused" on the frontend** -- Make sure the backend is running and `Librecord.Client/.env` contains `VITE_API_URL=https://localhost:5111`.

**Database migration fails** -- Check that PostgreSQL is running with `docker compose ps`. If the schema is out of sync, the migration script offers to drop and recreate the database.

**HTTPS certificate errors** -- Run `dotnet dev-certs https --trust` (macOS/Windows) or accept the browser warning (Linux).

**MinIO "bucket not found"** -- You need to create the bucket first. See [step 3](#3-create-the-minio-bucket).
