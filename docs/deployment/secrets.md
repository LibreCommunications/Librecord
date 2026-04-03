# Secrets and Environment Variables

How to generate and manage secrets for Librecord.

## Generating secrets

Use the included script to generate all required secrets:

```bash
.github/scripts/gen-secrets.sh > .env
```

This generates random values for:

| Variable | Purpose |
|----------|---------|
| `POSTGRES_PASSWORD` | Database password |
| `MINIO_ACCESS_KEY` | MinIO access key |
| `MINIO_SECRET_KEY` | MinIO secret key |
| `JWT_SIGNING_KEY` | JWT token signing key |
| `MESSAGE_ENCRYPTION_KEY` | AES-256-GCM key for message encryption at rest |
| `LIVEKIT_API_KEY` | LiveKit API key (voice/video) |
| `LIVEKIT_API_SECRET` | LiveKit API secret (voice/video) |

> [!NOTE]
> The `MESSAGE_ENCRYPTION_KEY` is used for server-side at-rest encryption of all messages. Changing it after deployment will make existing messages unreadable.

## GitHub Actions secrets

For CI deployment, add these as repository secrets in GitHub (Settings > Secrets > Actions):

| Secret | Description |
|--------|-------------|
| `DOMAIN` | Your domain (e.g., `chat.example.com`) |
| `POSTGRES_PASSWORD` | Database password |
| `MINIO_ACCESS_KEY` | MinIO access key |
| `MINIO_SECRET_KEY` | MinIO secret key |
| `JWT_SIGNING_KEY` | JWT signing key |
| `MESSAGE_ENCRYPTION_KEY` | Message encryption key |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |

## Frontend environment

The frontend needs a `.env` file in `Librecord.Client/`.

**Production:**

```env
VITE_API_URL=https://your-domain.com/api
VITE_LIVEKIT_URL=wss://livekit.your-domain.com
```

**Local development:**

```env
VITE_API_URL=https://localhost:5111
VITE_LIVEKIT_URL=ws://localhost:7880
```

> [!TIP]
> For local development, the `.env` file is already pre-configured. You only need to create one for production deployments.
