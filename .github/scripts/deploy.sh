#!/usr/bin/env bash
set -euo pipefail

ENV="${1:?Usage: deploy.sh <prod|test>}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

case "$ENV" in
  prod)
    BLUE_PORT=5111
    GREEN_PORT=5112
    PROJECT="librecord"
    ;;
  test)
    BLUE_PORT=5121
    GREEN_PORT=5122
    PROJECT="librecord-test"
    ;;
  *)
    echo "Unknown environment: $ENV"
    exit 1
    ;;
esac

STATE_DIR="$HOME/.${PROJECT}"
mkdir -p "$STATE_DIR"
STATE_FILE="${STATE_DIR}/active-slot"
UPSTREAM_FILE="/etc/nginx/conf.d/${PROJECT}-upstream.conf"
IMAGE="${PROJECT}-backend:latest"

# Determine current active slot
ACTIVE=$(cat "$STATE_FILE" 2>/dev/null || echo "none")
if [ "$ACTIVE" = "blue" ]; then
  NEW_SLOT="green"
  NEW_PORT=$GREEN_PORT
else
  NEW_SLOT="blue"
  NEW_PORT=$BLUE_PORT
fi

CONTAINER="${PROJECT}-backend-${NEW_SLOT}"

echo "=== Blue-Green Deploy: $ENV ==="
echo "Active: $ACTIVE -> Deploying: $NEW_SLOT (port $NEW_PORT)"

# Export for docker compose
export BLUE_PORT GREEN_PORT

# Source .env for backend environment variables
set -a
# shellcheck disable=SC1091
source "$REPO_DIR/.env"
set +a

# Ensure infra services are running (may already be started by CI)
echo "Ensuring infra services are up..."
if [ "$ENV" = "prod" ]; then
  docker compose -p "$PROJECT" --env-file "$REPO_DIR/.env" -f "$REPO_DIR/docker-compose.yml" --profile livekit up -d postgres minio livekit
else
  docker compose -p "$PROJECT" --env-file "$REPO_DIR/.env" -f "$REPO_DIR/docker-compose.yml" up -d postgres minio
fi

# Wait for postgres to be ready before starting the backend
PG_CONTAINER=$(docker ps --filter "name=${PROJECT}.*postgres" --format '{{.Names}}' | head -1)
echo "Waiting for PostgreSQL ($PG_CONTAINER) to accept connections..."
for i in $(seq 1 15); do
  if [ -n "$PG_CONTAINER" ] && docker exec "$PG_CONTAINER" pg_isready -U "${POSTGRES_USER:-$POSTGRES_DB}" > /dev/null 2>&1; then
    echo "PostgreSQL ready on attempt $i"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "WARNING: PostgreSQL readiness check timed out after 15s"
    echo "Postgres container logs:"
    docker logs --tail 20 "$PG_CONTAINER" 2>&1 || true
  fi
  sleep 1
done

# Get the docker network so the backend can reach postgres/minio by service name
DOCKER_NETWORK="${PROJECT}_default"

# Remove old container if it exists
docker rm -f "$CONTAINER" 2>/dev/null || true

# Start new backend container directly (no compose build needed)
echo "Starting $CONTAINER on port $NEW_PORT..."
docker run -d \
  --name "$CONTAINER" \
  --network "$DOCKER_NETWORK" \
  --restart unless-stopped \
  -p "127.0.0.1:${NEW_PORT}:5111" \
  -e ASPNETCORE_ENVIRONMENT=Production \
  -e ASPNETCORE_URLS=http://+:5111 \
  -e "AllowedHosts=${DOMAIN};localhost;127.0.0.1" \
  -e "ConnectionStrings__Default=Host=postgres;Port=5432;Database=${POSTGRES_DB};Username=${POSTGRES_USER:-$POSTGRES_DB};Password=${POSTGRES_PASSWORD}" \
  -e Jwt__Issuer=Librecord \
  -e Jwt__Audience=LibrecordClient \
  -e "Jwt__SigningKey=${JWT_SIGNING_KEY}" \
  -e Jwt__AccessTokenMinutes=15 \
  -e Jwt__RefreshTokenDays=14 \
  -e "Minio__Endpoint=minio:9000" \
  -e "Minio__AccessKey=${MINIO_ACCESS_KEY}" \
  -e "Minio__SecretKey=${MINIO_SECRET_KEY}" \
  -e "Minio__Bucket=${MINIO_BUCKET:-librecord-attachments}" \
  -e Minio__UseSSL=false \
  -e "Minio__PublicEndpoint=https://${DOMAIN}/storage" \
  -e "Security__MessageEncryptionKey=${MESSAGE_ENCRYPTION_KEY}" \
  -e "LiveKit__Host=${LIVEKIT_HOST:-wss://livekit.gros-sans-dessein.com}" \
  -e "LiveKit__ApiKey=${LIVEKIT_API_KEY}" \
  -e "LiveKit__ApiSecret=${LIVEKIT_API_SECRET}" \
  -e "Cors__Origins__0=https://${DOMAIN}" \
  "$IMAGE"

# Health check with timeout
echo "Waiting for health check on port $NEW_PORT..."
ATTEMPTS=30
for i in $(seq 1 $ATTEMPTS); do
  # Check if container is still running
  CSTATE=$(docker inspect "$CONTAINER" --format '{{.State.Status}}' 2>/dev/null || echo "gone")
  if [ "$CSTATE" != "running" ]; then
    echo "ERROR: Container exited unexpectedly (status: $CSTATE)"
    echo "=== Container logs ==="
    docker logs --tail 50 "$CONTAINER" 2>&1 || true
    echo "=== End of logs ==="
    docker rm -f "$CONTAINER" 2>/dev/null || true
    exit 1
  fi
  if curl -sf "http://127.0.0.1:$NEW_PORT/health" > /dev/null 2>&1; then
    echo "Health check passed on attempt $i"
    break
  fi
  if [ "$i" -eq "$ATTEMPTS" ]; then
    echo "ERROR: Health check failed after $ATTEMPTS attempts"
    echo "=== Container logs ==="
    docker logs --tail 50 "$CONTAINER" 2>&1 || true
    echo "=== End of logs ==="
    echo "Rolling back: stopping $CONTAINER"
    docker stop "$CONTAINER" 2>/dev/null || true
    docker rm -f "$CONTAINER" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

# Switch nginx upstream to new slot
echo "Switching nginx upstream to $NEW_SLOT (port $NEW_PORT)..."
echo "upstream ${PROJECT}-backend { server 127.0.0.1:$NEW_PORT; }" > "$UPSTREAM_FILE"
sudo /usr/sbin/nginx -t && sudo /usr/sbin/nginx -s reload

# Stop old slot
if [ "$ACTIVE" != "none" ]; then
  OLD_CONTAINER="${PROJECT}-backend-${ACTIVE}"
  echo "Stopping old $OLD_CONTAINER..."
  docker stop "$OLD_CONTAINER" 2>/dev/null || true
  docker rm -f "$OLD_CONTAINER" 2>/dev/null || true
fi

# Persist active slot
echo "$NEW_SLOT" > "$STATE_FILE"

echo "=== Deploy complete: $ENV running on $NEW_SLOT (port $NEW_PORT) ==="
