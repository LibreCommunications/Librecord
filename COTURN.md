# Coturn Setup (TODO)

Ports already open on server (UFW) and router:
- UDP 443 — TURN/UDP
- UDP 10000:30000 — TURN relay range

DNS and cert ready:
- `turn.gros-sans-dessein.com` → 142.169.255.144 (Cloudflare DNS-only)
- `/etc/letsencrypt/live/turn.gros-sans-dessein.com/`

Use `rtc.turn_servers` in livekit.yaml to point to external coturn.
