# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Librecord is a self-hosted Discord alternative with a .NET 10 backend and React 19 frontend. Real-time messaging, voice/video calls, servers with roles and permissions.

## Architecture

### Backend — four-layer clean architecture

- **Librecord.Api** — ASP.NET Core controllers, SignalR hubs, DTOs, request models, DI setup
- **Librecord.Application** — Business logic services (auth, messaging, guilds, friendships, permissions)
- **Librecord.Domain** — Domain entities, interfaces, enums (no dependencies on other layers)
- **Librecord.Infra** — EF Core DbContext, repositories, migrations, AES-256-GCM encryption service, MinIO storage, JWT generation

### Frontend — monorepo with platform abstraction

```
Librecord.Client/
  apps/
    web/                    Vite web app entry point
    desktop/                Electron desktop app
  packages/
    domain/                 Pure TS types, realtime types, logger, cache utils
    api-client/             HTTP client, fetchWithAuth, SignalR connection
    app/                    React hooks, contexts, voice, realtime listeners
    platform/               Platform abstraction interfaces (storage, events, http, etc.)
    platform-web/           Browser implementations of platform interfaces
    platform-electron/      Re-exports platform-web (Electron renderer is Chromium)
    platform-native/        React Native implementations (stub)
    design/                 Tailwind CSS, design tokens
    ui-web/                 React DOM components and pages
    ui-native/              React Native components (stub)
```

**Key pattern**: Business logic in `app/` and `api-client/` depends on `platform/` interfaces, never on browser APIs directly. Platform implementations are wired in at the app entry point (`main.tsx`).

## Tech Stack

- **Backend**: .NET 10, EF Core 10 + PostgreSQL 18, SignalR, ASP.NET Identity, JWT (HttpOnly cookies)
- **Frontend**: React 19, TypeScript 5.9, Vite 8 (Rolldown), Tailwind CSS 4.1, @microsoft/signalr
- **Voice/Video**: LiveKit (WebRTC)
- **Infra**: PostgreSQL 18, MinIO (S3-compatible), Docker Compose, nginx
- **Monorepo**: pnpm workspaces + Turborepo
- **Desktop**: Electron with vite-plugin-electron

## Common Commands

### Backend
```bash
dotnet build Librecord.sln
dotnet run --project Librecord.Api
dotnet test Librecord.Tests
```

### Frontend (from Librecord.Client/)
```bash
pnpm dev                  # Web dev server (https://localhost:5173)
pnpm build                # TypeScript check + Vite production build
pnpm lint                 # ESLint
pnpm dev:desktop          # Electron dev mode
pnpm build:desktop        # Electron production build
```

### Database
```bash
# Start PostgreSQL + MinIO
docker compose up -d postgres minio

# Run migrations (interactive — scaffolds + applies)
./ef-migrate.sh

# Apply existing migrations only (non-interactive)
./ef-migrate.sh --apply-only

# Manual EF commands use these flags:
#   --project Librecord.Infra/Librecord.Infra.csproj
#   --startup-project Librecord.Api/Librecord.Api.csproj
#   --context Librecord.Infra.Database.LibrecordContext
```

## Key Patterns

- **Authentication**: JWT access tokens (15 min) + refresh tokens (14 days) stored as HttpOnly cookies. SignalR reads the access token from the cookie on connection.
- **Message encryption**: Server-side AES-256-GCM at-rest encryption via `AesGcmMessageEncryptionService`. Each message gets a random salt and nonce. Ciphertext layout: `[ciphertext | authTag(16) | nonce(12)]`.
- **Real-time**: Single SignalR hub at `/hubs/app`. Events are dispatched through `dispatchAppEvent()` which uses the platform `EventBus`. Listeners in `packages/app/src/realtime/listeners.ts`.
- **Optimistic UI**: Client generates a `clientMessageId` (UUID) on send; server echoes it back in the real-time event for reconciliation.
- **Permissions**: Role-based with per-channel overrides (allow/deny/inherit). Permission IDs are deterministic UUIDs.
- **Platform abstraction**: Interfaces in `packages/platform/` (StorageAdapter, EventBus, HttpClient, NotificationService, AudioService, UUIDGenerator, LifecycleService). Web implementations in `packages/platform-web/`. Injected via React context (`usePlatform()`).
- **Connection hooks**: `packages/api-client/src/connection.ts` uses a callback pattern (`setConnectionHooks`) so the app layer can handle voice reconnection without circular dependencies.
- **JSON convention**: camelCase naming policy throughout API responses.
- **CI/CD**: GitHub Actions with self-hosted runner. Blue-green deployment via `deploy.sh`. Turbo caches builds.
