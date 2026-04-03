# Docker Setup

How Librecord uses Docker Compose for infrastructure and deployment.

Librecord runs PostgreSQL, MinIO, and LiveKit as Docker Compose services. The .NET backend runs in standalone containers managed by the [blue-green deployment](blue-green.md) script.

## Services

| Service | Image | Purpose | Default Port |
|---------|-------|---------|-------------|
| PostgreSQL 18 | `postgres:18` | Database | 5432 |
| MinIO | `minio/minio` | S3-compatible file storage | 9000 (API), 9001 (console) |
| LiveKit | `livekit/livekit-server` | Voice and video (optional) | 7880 |

> [!NOTE]
> All services are bound to `127.0.0.1`. They are only accessible through the nginx reverse proxy, not directly from the internet.

## Environment variables

Create a `.env` file in the project root using the secret generator:

```bash
.github/scripts/gen-secrets.sh > .env
```

Then add your domain and port configuration:

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

For a full breakdown of each variable, see [secrets.md](secrets.md).

## Starting services

```bash
# Start PostgreSQL and MinIO
docker compose up -d postgres minio

# Include LiveKit for voice and video
docker compose --profile livekit up -d postgres minio livekit
```

## Compose file structure

The `docker-compose.yml` defines:

- **backend-blue / backend-green** -- Two backend slots for zero-downtime deployment. Managed by `deploy.sh`, not started directly.
- **postgres** -- Database with health checks.
- **minio** -- Object storage for file attachments.
- **livekit** -- WebRTC media server. Behind the `livekit` profile, so it only starts when explicitly requested.
