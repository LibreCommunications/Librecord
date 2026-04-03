# Deploying Librecord

A complete guide to deploying Librecord on a Linux server from scratch.

> [!WARNING]
> This documentation was written after the fact and may not be fully accurate. This is a solo project - if something doesn't work, please open an issue and be patient.

## Prerequisites

- A Linux server (Debian/Ubuntu recommended)
- A domain name with DNS pointing to your server
- Root or sudo access

## Step 1: Install dependencies

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# .NET 10 SDK
# See https://learn.microsoft.com/en-us/dotnet/core/install/linux

# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# pnpm
sudo npm i -g pnpm

# Nginx + Certbot
sudo apt install -y nginx certbot python3-certbot-nginx
```

Log out and back in so Docker works without sudo.

## Step 2: Get SSL certificates

```bash
sudo certbot certonly --nginx -d your-domain.com
sudo certbot certonly --nginx -d livekit.your-domain.com    # optional, for voice/video
sudo certbot certonly --nginx -d turn.your-domain.com       # optional, for TURN relay
```

## Step 3: Clone the repository

```bash
git clone https://github.com/LibreCommunications/Librecord.git
cd Librecord
```

## Step 4: Generate secrets

```bash
.github/scripts/gen-secrets.sh > .env
```

Open `.env` and add these lines at the top:

```env
DOMAIN=your-domain.com
POSTGRES_DB=librecord
POSTGRES_USER=librecord
POSTGRES_PORT=5432
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_BUCKET=librecord-attachments
BLUE_PORT=5111
GREEN_PORT=5112
```

The remaining values (passwords, keys, tokens) were generated automatically.

Then create the frontend environment file:

```bash
echo 'VITE_API_URL=https://your-domain.com/api' > Librecord.Client/.env
echo 'VITE_LIVEKIT_URL=wss://livekit.your-domain.com' >> Librecord.Client/.env
```

For details on all environment variables, see [secrets.md](secrets.md).

## Step 5: Start Docker services

```bash
# PostgreSQL + MinIO
docker compose up -d postgres minio

# Wait for PostgreSQL to be ready
docker compose exec postgres pg_isready -U librecord
```

### Create the MinIO bucket

```bash
# Install MinIO client
curl -O https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# Configure it (uses the access/secret key from your .env)
source .env
mc alias set local http://localhost:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"

# Create the bucket
mc mb local/librecord-attachments

# Set public read on public prefixes (avatars, icons, etc.)
mc anonymous set download local/librecord-attachments/avatars
mc anonymous set download local/librecord-attachments/guild-icons
mc anonymous set download local/librecord-attachments/banners
mc anonymous set download local/librecord-attachments/thumbnails
mc anonymous set download local/librecord-attachments/emojis
```

## Step 6: Build and deploy the backend

```bash
# Build
dotnet build Librecord.sln -c Release
dotnet publish Librecord.Api/Librecord.Api.csproj -c Release -o .publish

# Build Docker image
printf 'FROM mcr.microsoft.com/dotnet/aspnet:10.0\nWORKDIR /app\nRUN apt-get update && apt-get install -y --no-install-recommends libkrb5-3 && rm -rf /var/lib/apt/lists/*\nRUN useradd --no-create-home --shell /bin/false appuser\nCOPY --chown=appuser .publish/ .\nUSER appuser\nEXPOSE 5111\nENTRYPOINT ["dotnet", "Librecord.Api.dll"]\n' | \
docker build -t librecord-backend:latest -f - .

# Deploy (blue-green)
chmod +x .github/scripts/deploy.sh
.github/scripts/deploy.sh prod
```

See [blue-green.md](blue-green.md) for how the deployment pipeline works.

## Step 7: Build and deploy the frontend

```bash
cd Librecord.Client
pnpm install
pnpm build

# Copy to web root
sudo mkdir -p /var/www/librecord
sudo cp -r apps/web/dist /var/www/librecord/dist
cd ..
```

## Step 8: Configure nginx

### Hardening config

Install the Brotli module and create `/etc/nginx/conf.d/hardening.conf`:

```bash
sudo apt install libnginx-mod-brotli
```

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

gzip_vary on;
gzip_min_length 256;
gzip_comp_level 5;
gzip_types application/json application/javascript text/css text/plain text/xml image/svg+xml;

# Brotli -- ~20% smaller than gzip for text assets
brotli on;
brotli_comp_level 6;
brotli_min_length 256;
brotli_types application/json application/javascript text/css text/plain text/xml image/svg+xml application/wasm;
brotli_static on;
```

### Cache config

Add this inside the `http {}` block in `/etc/nginx/nginx.conf` (or in a file under `conf.d/`):

```nginx
proxy_cache_path /var/cache/nginx/cdn levels=1:2 keys_zone=cdn_cache:10m max_size=500m inactive=24h;
```

### Site config

Copy the nginx config from [nginx.md](nginx.md) into `/etc/nginx/sites-enabled/librecord`. Replace all instances of `your-domain.com` with your actual domain.

### Test and reload

```bash
sudo nginx -t
sudo nginx -s reload
```

For the full nginx reference (all config files, security headers, LiveKit proxy), see [nginx.md](nginx.md).

## Step 9: LiveKit setup (optional)

LiveKit powers voice calls, video calls, and screen sharing. See [livekit.md](livekit.md) for the full setup guide including firewall ports and TURN configuration.

Quick version:

```bash
# Create LiveKit config
sudo mkdir -p /etc/livekit
sudo nano /etc/livekit/livekit.yaml   # See livekit.md for contents

# Open firewall ports
sudo ufw allow 7881/tcp
sudo ufw allow 3478
sudo ufw allow 10000:30000/udp
sudo ufw allow 50000:60000/udp

# Start LiveKit
docker compose --profile livekit up -d livekit
```

## Step 10: Set up CI (optional)

Automatic deployments on push to `master`:

1. Install a [GitHub Actions self-hosted runner](https://docs.github.com/en/actions/hosting-your-own-runners) on your server.

2. Add secrets in your GitHub repo settings (Settings > Secrets > Actions):
   - `DOMAIN`, `POSTGRES_PASSWORD`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
   - `JWT_SIGNING_KEY`, `MESSAGE_ENCRYPTION_KEY`
   - `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`

3. Allow the runner to reload nginx without a password:
   ```bash
   echo "$USER ALL=(root) NOPASSWD: /usr/sbin/nginx -t, /usr/sbin/nginx -s reload" | sudo tee /etc/sudoers.d/nginx-reload
   ```

4. Push to `master` for production, `test` for the test environment.

See [blue-green.md](blue-green.md) for how the deployment pipeline works.

## Verify

Open `https://your-domain.com` in your browser. You should see the login page.

## Updating

With CI set up (step 10), push to `master` and it deploys automatically.

For manual updates:

```bash
cd Librecord
git pull

# Backend
dotnet publish Librecord.Api/Librecord.Api.csproj -c Release -o .publish
docker build -t librecord-backend:latest -f Dockerfile .
.github/scripts/deploy.sh prod

# Frontend
cd Librecord.Client
pnpm install
pnpm build
sudo cp -r apps/web/dist /var/www/librecord/dist
```

## Architecture overview

```
Internet --> nginx (SSL, rate limiting, static files)
                |-- /            --> Static frontend (Vite build)
                |-- /api/        --> .NET backend (blue or green container)
                |-- /api/hubs/   --> SignalR WebSocket
                |-- /api/cdn/    --> MinIO public assets (cached by nginx)
                \-- /storage/    --> MinIO private attachments
```

## Detailed guides

- [nginx.md](nginx.md) -- Full nginx configuration reference
- [docker.md](docker.md) -- Docker Compose services and setup
- [blue-green.md](blue-green.md) -- Zero-downtime deployment pipeline
- [secrets.md](secrets.md) -- Environment variables and secret management
- [livekit.md](livekit.md) -- Voice and video server setup
