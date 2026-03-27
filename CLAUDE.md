# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Librecord is a Discord-like real-time messaging platform with a .NET 10.0 backend and React 19 frontend.

## Architecture

Four-layer clean architecture:

- **Librecord.Api** — ASP.NET Core controllers, SignalR hubs, DTOs, request models, DI setup
- **Librecord.Application** — Business logic services (auth, messaging, guilds, friendships, permissions)
- **Librecord.Domain** — Domain entities, interfaces, enums (no dependencies on other layers)
- **Librecord.Infra** — EF Core DbContext, repositories, migrations, AES-256-GCM encryption service, MinIO storage, JWT generation

**Frontend (Librecord.Client)** — React 19 + TypeScript 5.9 + Vite + Tailwind CSS 4.1. SignalR client for real-time messaging. Optimistic UI with client-generated message IDs.

## Tech Stack

- **Backend**: .NET 10.0, EF Core 10 + PostgreSQL, SignalR, ASP.NET Identity, JWT (HttpOnly cookies)
- **Frontend**: React 19, TypeScript 5.9, Vite (rolldown), Tailwind CSS 4.1, @microsoft/signalr
- **Infra**: PostgreSQL 18, MinIO (S3-compatible attachment storage), Podman + Compose

## Common Commands

### Backend
```bash
dotnet build Librecord.sln
dotnet run --project Librecord.Api
```

### Frontend
```bash
cd Librecord.Client
npm run dev          # Vite dev server (HTTPS, port 5173)
npm run build        # TypeScript check + production build
npm run lint         # ESLint
```

### Database
```bash
# Start PostgreSQL + MinIO
podman-compose -f podman-compose.dev.yml up -d

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
- **Message encryption**: Server-side AES-256-GCM at-rest encryption via `AesGcmMessageEncryptionService`. Each message gets a random salt and nonce. Ciphertext layout: `[ciphertext | authTag(16) | nonce(12)]`. Encryption metadata stored on `DmChannelMessage.EncryptionSalt` / `.EncryptionAlgorithm`.
- **Real-time**: SignalR hub at `/hubs/dms` (`DmHub`). Users auto-join their DM channel groups on connect. Events: `DmMessageCreated`, `DmMessageEdited`, `DmMessageDeleted`. Broadcast via `IDmRealtimeNotifier`.
- **Optimistic UI**: Client generates a `clientMessageId` (UUID) on send; server echoes it back in the real-time event for reconciliation.
- **Permissions**: Role-based with per-channel overrides (allow/deny/inherit). Permission IDs are deterministic UUIDs.
- **JSON convention**: camelCase naming policy throughout API responses.
