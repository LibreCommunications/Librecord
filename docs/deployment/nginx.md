# Nginx Configuration

Full nginx configuration reference for Librecord. Nginx acts as the reverse proxy, serving the static frontend, proxying API and WebSocket traffic, and caching public CDN assets.

## Overview

- Static frontend served from `/var/www/librecord/dist`
- API requests proxied to the .NET backend (blue-green upstream)
- SignalR WebSocket connections proxied with upgrade headers
- Public CDN assets (avatars, icons) served from MinIO with nginx disk caching
- Private attachments served through MinIO presigned URLs

## Config files

| File | Location | Purpose |
|------|----------|---------|
| `librecord.conf` | `/etc/nginx/sites-enabled/` | Main site config |
| `hardening.conf` | `/etc/nginx/conf.d/` | Rate limiting, gzip, Brotli |
| `livekit.conf` | `/etc/nginx/sites-enabled/` | LiveKit WebSocket proxy (optional) |
| `librecord-upstream.conf` | `/etc/nginx/conf.d/` | Blue-green upstream (managed by `deploy.sh`) |

## Prerequisites

Add this to your `nginx.conf` inside the `http {}` block (or to a file in `conf.d/`):

```nginx
proxy_cache_path /var/cache/nginx/cdn levels=1:2 keys_zone=cdn_cache:10m max_size=500m inactive=24h;
```

## Main site config

Replace `your-domain.com` with your actual domain. Replace `livekit.your-domain.com` with your LiveKit subdomain in the CSP header.

```nginx
# Blue-green upstream is managed by deploy.sh
# File: /etc/nginx/conf.d/librecord-upstream.conf

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    root /var/www/librecord/dist;
    index index.html;

    # Auth endpoints -- strict rate limit
    location /api/auth/ {
        limit_req zone=auth burst=10 nodelay;

        proxy_pass http://librecord-backend/auth/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cookie_path / /;
    }

    # Public CDN -- nginx serves directly from MinIO, cached on disk
    location ~ ^/api/cdn/public/(avatars|guild-icons|banners|thumbnails|emojis)/ {
        rewrite ^/api/cdn/public/(.*)$ /librecord-attachments/$1 break;

        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host minio:9000;
        proxy_hide_header x-amz-request-id;
        proxy_hide_header x-amz-id-2;
        proxy_buffering on;

        proxy_cache cdn_cache;
        proxy_cache_valid 200 24h;
        proxy_cache_valid 404 1m;
        proxy_cache_key $uri;
        proxy_ignore_headers Set-Cookie;
        add_header X-Cache-Status $upstream_cache_status;
        add_header Cache-Control "public, max-age=86400";
    }

    # Private CDN -- attachment redirects (lightweight, auth-gated in backend)
    location /api/cdn/private/ {
        limit_req zone=api burst=200 nodelay;

        proxy_pass http://librecord-backend/cdn/private/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cookie_path / /;
    }

    # API reverse proxy
    location /api/ {
        limit_req zone=api burst=60 nodelay;

        proxy_pass http://librecord-backend/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        client_max_body_size 100M;
        client_body_timeout 300;
        proxy_cookie_path / /;
    }

    # SignalR hubs (WebSocket)
    location /api/hubs/ {
        proxy_pass http://librecord-backend/hubs/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 1800;
        proxy_send_timeout 1800;
    }

    # MinIO presigned URL proxy (private attachments)
    location /storage/ {
        proxy_pass http://127.0.0.1:9000/;
        proxy_set_header Host minio:9000;
        proxy_hide_header x-amz-request-id;
        proxy_hide_header x-amz-id-2;
        proxy_buffering on;
    }

    # Vite assets -- hashed filenames, cache forever
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-Permitted-Cross-Domain-Policies "none" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' wss://livekit.your-domain.com https://livekit.your-domain.com; media-src 'self' blob:; font-src 'self'; frame-ancestors 'none';" always;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~ /\. {
        deny all;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

## Hardening config

Place in `/etc/nginx/conf.d/hardening.conf`.

Requires the `ngx_brotli` module:

```bash
sudo apt install libnginx-mod-brotli   # Debian/Ubuntu
```

```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

# Enhanced gzip
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

## LiveKit config (optional)

Required for voice and video. Place in `/etc/nginx/sites-enabled/livekit.conf`.

See [livekit.md](livekit.md) for the full LiveKit server setup.

```nginx
server {
    listen 443 ssl;
    server_name livekit.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/livekit.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/livekit.your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}

server {
    listen 80;
    server_name livekit.your-domain.com;
    return 301 https://$host$request_uri;
}
```
