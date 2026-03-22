# Dev Environment Setup

## Prerequisites

- **Docker** (or Podman) + Docker Compose
- **.NET 10.0 SDK**
- **Node.js 20+** and npm
- **Git**

## 1. Start Infrastructure

```bash
docker-compose -f docker-compose.dev.yml up -d
```

This starts 3 services:

| Service | Port(s) | Credentials |
|---------|---------|-------------|
| PostgreSQL 18 | 5432 | `dev` / `devpass` |
| MinIO (attachment storage) | 9000 (API), 9001 (console) | `minioadmin` / `minioadmin` |
| LiveKit (voice/video) | 7880, 7881, 7882/udp | `devkey` / `devsecret_that_is_at_least_32chars!` |

Verify they're running:
```bash
docker-compose -f docker-compose.dev.yml ps
```

## 2. Generate HTTPS Certificates

Both the backend and frontend dev servers require HTTPS with self-signed certs.

```bash
mkdir -p ~/.aspnet/https

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout ~/.aspnet/https/localhost-key.pem \
  -out ~/.aspnet/https/localhost.pem \
  -days 365 -subj "/CN=localhost"
```

## 3. Update Certificate Paths in Backend Config

Edit `Librecord.Api/appsettings.Development.json` and update the cert paths to match your home directory:

```json
"Certificate": {
    "Path": "/home/YOUR_USERNAME/.aspnet/https/localhost.pem",
    "KeyPath": "/home/YOUR_USERNAME/.aspnet/https/localhost-key.pem"
}
```

## 4. Run Database Migrations

```bash
# Apply all existing migrations (non-interactive)
./ef-migrate.sh --apply-only
```

On first run this creates the database schema and seeds dev users.

If the script isn't executable: `chmod +x ef-migrate.sh`

## 5. Start the Backend

```bash
dotnet run --project Librecord.Api
```

Backend runs at **https://localhost:5111**. Swagger UI available at https://localhost:5111/swagger.

## 6. Set Up the Frontend

```bash
cd Librecord.Client

# Install dependencies
npm install

# Create the .env file
echo 'VITE_API_URL=https://localhost:5111' > .env
```

The `VITE_API_URL` variable is used by every hook and component to reach the API.

## 7. Start the Frontend

```bash
npm run dev
```

Frontend runs at **https://localhost:5173**.

Your browser will warn about the self-signed cert — accept it for both `localhost:5173` and `localhost:5111`.

## Port Summary

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite) | 5173 | https://localhost:5173 |
| Backend (ASP.NET) | 5111 | https://localhost:5111 |
| PostgreSQL | 5432 | localhost:5432 |
| MinIO API | 9000 | http://localhost:9000 |
| MinIO Console | 9001 | http://localhost:9001 |
| LiveKit | 7880 | ws://localhost:7880 |

## Full Startup Sequence (3 terminals)

```bash
# Terminal 1 — Infrastructure
docker-compose -f docker-compose.dev.yml up -d

# Terminal 2 — Backend
./ef-migrate.sh --apply-only
dotnet run --project Librecord.Api

# Terminal 3 — Frontend
cd Librecord.Client
npm install
npm run dev
```

## Troubleshooting

**"connection refused" on PostgreSQL**
- Check Docker is running: `docker-compose -f docker-compose.dev.yml ps`
- Make sure port 5432 isn't used by a local PostgreSQL instance

**HTTPS errors in browser**
- Accept the self-signed cert for **both** localhost:5111 and localhost:5173
- Regenerate certs if they expired (365-day default)

**SignalR connection fails**
- Backend must be running on HTTPS
- Check browser console for CORS errors — CORS allows `https://localhost:5173` by default

**Migrations fail**
- Ensure dotnet-ef tool is installed: `dotnet tool restore`
- Check the connection string in `appsettings.Development.json`

**MinIO bucket not found**
- The backend auto-creates the bucket on first upload
- Check MinIO console at http://localhost:9001 (login: minioadmin/minioadmin)
