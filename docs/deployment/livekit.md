# LiveKit Setup (Voice and Video)

How to set up LiveKit for voice calls, video calls, and screen sharing in Librecord.

LiveKit is optional. Skip this guide if you do not need voice or video features. All other Librecord functionality works without it.

## How it works

LiveKit runs as a Docker container with `network_mode: host` so it can handle WebRTC UDP media traffic directly. Nginx proxies the WebSocket signaling traffic on port 443.

## Subdomains

LiveKit requires a separate subdomain:

- `livekit.your-domain.com` -- WebSocket signaling (proxied by nginx)
- `turn.your-domain.com` -- TURN relay for users behind strict firewalls (optional but recommended)

## SSL certificates

```bash
sudo certbot certonly --nginx -d livekit.your-domain.com
sudo certbot certonly --nginx -d turn.your-domain.com  # if using TURN
```

## LiveKit configuration

Create `/etc/livekit/livekit.yaml`:

```yaml
port: 7880
rtc:
    port_range_start: 50000
    port_range_end: 60000
    use_external_ip: false
    tcp_port: 7881
    node_ip: YOUR_SERVER_PUBLIC_IP
    use_ice_lite: false
turn:
    enabled: true
    domain: turn.your-domain.com
    tls_port: 3478
    cert_file: /etc/letsencrypt/live/turn.your-domain.com/fullchain.pem
    key_file: /etc/letsencrypt/live/turn.your-domain.com/privkey.pem
    relay_range_start: 10000
    relay_range_end: 30000
keys: {}
```

Replace:
- `YOUR_SERVER_PUBLIC_IP` with your server's public IP address
- `turn.your-domain.com` with your TURN subdomain

> [!NOTE]
> The `keys: {}` field is intentional. LiveKit reads API keys from the `LIVEKIT_KEYS` environment variable set in `docker-compose.yml`. See [secrets.md](secrets.md) for key generation.

## Firewall ports

Open these ports on your server:

| Port | Protocol | Purpose |
|------|----------|---------|
| 7880 | TCP | LiveKit HTTP/WebSocket (proxied by nginx) |
| 7881 | TCP | LiveKit TCP media fallback |
| 3478 | TCP/UDP | TURN relay |
| 10000-30000 | UDP | TURN relay range |
| 50000-60000 | UDP | WebRTC media range |

```bash
sudo ufw allow 7881/tcp
sudo ufw allow 3478
sudo ufw allow 10000:30000/udp
sudo ufw allow 50000:60000/udp
```

> [!TIP]
> Port 7880 does not need to be opened in the firewall. Nginx proxies it on port 443. See [nginx.md](nginx.md) for the LiveKit proxy configuration.

## Start LiveKit

```bash
docker compose --profile livekit up -d livekit
```

## Verify

```bash
curl http://localhost:7880
```

A successful response (not "connection refused") confirms LiveKit is running.
