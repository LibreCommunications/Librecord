#!/usr/bin/env bash
set -euo pipefail

ENV="${1:-prod}"

rand() { openssl rand -base64 "$1" | tr -d '/+=' | head -c "$1"; }

cat <<EOF
# Generated secrets for $ENV — $(date -I)

POSTGRES_PASSWORD=$(rand 32)
MINIO_ACCESS_KEY=$(rand 20)
MINIO_SECRET_KEY=$(rand 40)
JWT_SIGNING_KEY=$(rand 64)
MESSAGE_ENCRYPTION_KEY=$(openssl rand -hex 32)
LIVEKIT_API_KEY=API$(rand 12)
LIVEKIT_API_SECRET=$(rand 36)
EOF
