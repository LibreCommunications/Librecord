# Docker Setup

Librecord uses Docker Compose for infrastructure services (PostgreSQL, MinIO, LiveKit) and runs the .NET backend in standalone containers for blue-green deployment.

## Services

| Service | Image | Purpose | Default Port |
|---------|-------|---------|-------------|
| PostgreSQL 18 | `postgres:18` | Database | 5432 |
| MinIO | `minio/minio` | File storage (S3-compatible) | 9000 (API), 9001 (console) |
| LiveKit | `livekit/livekit-server` | Voice/video (optional) | 7880 |

## Environment Variables

Create a `.env` file in the project root. Use the secret generator to create one:

```bash
.github/scripts/gen-secrets.sh > .env
```

Then add your domain:

```env
DOMAIN=your-domain.com

# Generated secrets
POSTGRES_DB=librecord
POSTGRES_USER=librecord
POSTGRES_PASSWORD=<generated>
MINIO_ACCESS_KEY=<generated>
MINIO_SECRET_KEY=<generated>
MINIO_BUCKET=librecord-attachments
JWT_SIGNING_KEY=<generated>
MESSAGE_ENCRYPTION_KEY=<generated>
LIVEKIT_API_KEY=<generated>
LIVEKIT_API_SECRET=<generated>

# Ports
POSTGRES_PORT=5432
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
BLUE_PORT=5111
GREEN_PORT=5112
```

## Start Infrastructure

```bash
# Start PostgreSQL and MinIO
docker compose up -d postgres minio

# With LiveKit (for voice/video)
docker compose --profile livekit up -d postgres minio livekit
```

## docker-compose.yml

The compose file defines:
- **backend-blue / backend-green** — Two backend slots for zero-downtime deployment (managed by `deploy.sh`, not started directly)
- **postgres** — Database with health checks
- **minio** — Object storage for file attachments
- **livekit** — WebRTC media server (optional, behind the `livekit` profile)

All services are bound to `127.0.0.1` — they're only accessible through the nginx reverse proxy.
