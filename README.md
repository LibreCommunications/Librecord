# Librecord

A Discord-like real-time messaging platform with voice/video chat, built with .NET 10 and React 19.

## Features

- Real-time messaging (DMs and guild channels) via SignalR
- Voice and video calls via LiveKit/WebRTC
- Screen sharing
- Server-side AES-256-GCM message encryption at rest
- File attachments (images, videos, documents)
- Friend requests and blocking
- Guild (server) management with roles and permissions
- Channel permission overrides
- Message pinning, reactions, threads
- Typing indicators, read receipts, unread badges
- User presence (online, idle, do not disturb, invisible)
- Desktop notifications

## Architecture

Four-layer clean architecture:

```
Librecord.Api          — Controllers, SignalR hubs, DTOs, middleware
Librecord.Application  — Services, business logic, interfaces
Librecord.Domain       — Entities, repository interfaces, enums
Librecord.Infra        — EF Core, repositories, encryption, MinIO storage
Librecord.Client       — React 19 + TypeScript 5.9 + Vite + Tailwind CSS 4
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | .NET 10, ASP.NET Core, SignalR, EF Core 10, ASP.NET Identity |
| Frontend | React 19, TypeScript 5.9, Vite (Rolldown), Tailwind CSS 4.1 |
| Database | PostgreSQL 18 |
| Storage | MinIO (S3-compatible) |
| Voice/Video | LiveKit |
| Auth | JWT (HttpOnly cookies) with refresh token rotation |

## Quick Start

```bash
# One-command setup (requires Podman, .NET 10 SDK, Node.js 20+)
./setup-dev.sh

# Start backend
dotnet run --project Librecord.Api

# Start frontend (separate terminal)
cd Librecord.Client && npm run dev
```

See [DEV_SETUP.md](DEV_SETUP.md) for detailed setup instructions.

## Development

### Backend

```bash
dotnet build Librecord.sln          # Build
dotnet test Librecord.Tests          # Run unit tests (166 tests)
dotnet run --project Librecord.Api   # Run API server (https://localhost:5111)
```

### Frontend

```bash
cd Librecord.Client
npm run dev       # Dev server (https://localhost:5173)
npm run build     # TypeScript check + production build
npm run lint      # ESLint
npm run test:e2e  # Playwright E2E tests (124 tests)
```

### Database

```bash
./ef-migrate.sh              # Interactive migration helper
./ef-migrate.sh --apply-only # Apply existing migrations (non-interactive)
```

## Testing

- **Unit tests**: xUnit tests covering services, encryption, realtime events
- **E2E tests**: Playwright tests covering messaging, voice/video, user status, file uploads, realtime sync
- Tests run against localhost only (rate limiting skips loopback)

## Project Structure

```
Librecord.Api/
  Controllers/       — HTTP endpoints (thin, delegate to services)
  Hubs/              — SignalR hubs (DM, Guild)
  RealtimeNotifiers/ — SignalR event dispatchers
  Dtos/              — Response DTOs
  Middleware/        — Global exception handler

Librecord.Application/
  Messaging/         — Message, pin, thread, search, attachment services
  Guilds/            — Guild, member, settings, invite services
  Social/            — Block, friendship services
  Permissions/       — Role-based + channel override permissions
  Realtime/          — Event types and notifier interfaces
  Users/             — User profile service

Librecord.Domain/
  Identity/          — User entity and repository interface
  Guilds/            — Guild, role, channel, ban entities
  Messaging/         — Message, attachment, pin, thread entities
  Social/            — Friendship, block entities

Librecord.Infra/
  Database/          — EF Core DbContext, configurations, migrations
  Repositories/      — Repository implementations
  Security/          — AES-GCM encryption, JWT token generation

Librecord.Client/
  src/
    components/      — Reusable UI components
    pages/           — Route-based page components
    hooks/           — Custom React hooks (API abstraction)
    realtime/        — SignalR connection management
    context/         — Auth, Toast, Presence providers
```

## Note

### The front end needs to be changed to something like this

```text
Librecord.Client/
  apps/
    web/
    desktop/
    mobile/
  packages/
    domain/
    api-client/
    app/
    platform/
    platform-web/
    platform-electron/
    platform-native/
    design/
    ui-web/
    ui-native/
```


## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
