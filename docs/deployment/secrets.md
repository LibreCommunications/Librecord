# Secrets & Environment

## Generating Secrets

Use the included script to generate all required secrets:

```bash
.github/scripts/gen-secrets.sh > .env
```

This generates random values for:
- `POSTGRES_PASSWORD` — database password
- `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` — object storage credentials
- `JWT_SIGNING_KEY` — JWT token signing key
- `MESSAGE_ENCRYPTION_KEY` — AES-256-GCM key for message encryption at rest
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` — voice/video server credentials

## GitHub Actions Secrets

For CI deployment, add these as repository secrets in GitHub:

| Secret | Description |
|--------|-------------|
| `DOMAIN` | Your domain (e.g. `chat.example.com`) |
| `POSTGRES_PASSWORD` | Database password |
| `MINIO_ACCESS_KEY` | MinIO access key |
| `MINIO_SECRET_KEY` | MinIO secret key |
| `JWT_SIGNING_KEY` | JWT signing key |
| `MESSAGE_ENCRYPTION_KEY` | Message encryption key |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |

## Frontend Environment

The frontend needs a `.env` file in `Librecord.Client/`:

```env
VITE_API_URL=https://your-domain.com/api
VITE_LIVEKIT_URL=wss://livekit.your-domain.com
```

For local development:

```env
VITE_API_URL=https://localhost:5111
VITE_LIVEKIT_URL=ws://localhost:7880
```
