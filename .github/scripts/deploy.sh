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

STATE_FILE="/tmp/${PROJECT}-active-slot"
UPSTREAM_FILE="/etc/nginx/conf.d/${PROJECT}-upstream.conf"

# Determine current active slot
ACTIVE=$(cat "$STATE_FILE" 2>/dev/null || echo "none")
if [ "$ACTIVE" = "blue" ]; then
  NEW_SLOT="green"
  NEW_PORT=$GREEN_PORT
else
  NEW_SLOT="blue"
  NEW_PORT=$BLUE_PORT
fi

echo "=== Blue-Green Deploy: $ENV ==="
echo "Active: $ACTIVE -> Deploying: $NEW_SLOT (port $NEW_PORT)"

# Export ports for docker compose
export BLUE_PORT GREEN_PORT
export COMPOSE_PROJECT_NAME="$PROJECT"

# Ensure infra services are running (livekit is shared, only start with prod)
echo "Ensuring infra services are up..."
if [ "$ENV" = "prod" ]; then
  docker compose -p "$PROJECT" -f "$REPO_DIR/docker-compose.yml" up -d postgres minio livekit
else
  docker compose -p "$PROJECT" -f "$REPO_DIR/docker-compose.yml" up -d postgres minio
fi

# Build and start new backend slot
echo "Starting backend-$NEW_SLOT on port $NEW_PORT..."
docker compose -p "$PROJECT" -f "$REPO_DIR/docker-compose.yml" --profile "$NEW_SLOT" up -d --build "backend-$NEW_SLOT"

# Health check with timeout
echo "Waiting for health check on port $NEW_PORT..."
ATTEMPTS=30
for i in $(seq 1 $ATTEMPTS); do
  if curl -sf "http://127.0.0.1:$NEW_PORT/health" > /dev/null 2>&1; then
    echo "Health check passed on attempt $i"
    break
  fi
  if [ "$i" -eq "$ATTEMPTS" ]; then
    echo "ERROR: Health check failed after $ATTEMPTS attempts"
    echo "Rolling back: stopping backend-$NEW_SLOT"
    docker compose -p "$PROJECT" -f "$REPO_DIR/docker-compose.yml" --profile "$NEW_SLOT" stop "backend-$NEW_SLOT"
    exit 1
  fi
  sleep 2
done

# Switch nginx upstream to new slot
echo "Switching nginx upstream to $NEW_SLOT (port $NEW_PORT)..."
echo "upstream ${PROJECT}-backend { server 127.0.0.1:$NEW_PORT; }" > "$UPSTREAM_FILE"
sudo /usr/sbin/nginx -t && sudo /usr/sbin/nginx -s reload

# Stop old slot
if [ "$ACTIVE" != "none" ]; then
  echo "Stopping old backend-$ACTIVE..."
  docker compose -p "$PROJECT" -f "$REPO_DIR/docker-compose.yml" --profile "$ACTIVE" stop "backend-$ACTIVE"
fi

# Persist active slot
echo "$NEW_SLOT" > "$STATE_FILE"

echo "=== Deploy complete: $ENV running on $NEW_SLOT (port $NEW_PORT) ==="
