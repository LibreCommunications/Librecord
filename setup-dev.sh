#!/usr/bin/env bash
#
# Librecord — One-command dev environment setup
#
# Usage:
#   ./setup-dev.sh            Full setup (infra + certs + backend + frontend)
#   ./setup-dev.sh --skip-infra   Skip Docker containers (already running)
#   ./setup-dev.sh --skip-certs   Skip certificate generation (already have them)
#
set -euo pipefail

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="$HOME/.aspnet/https"
CERT_KEY="$CERT_DIR/localhost-key.pem"
CERT_PEM="$CERT_DIR/localhost.pem"
CLIENT_DIR="$SCRIPT_DIR/Librecord.Client"
API_PROJECT="$SCRIPT_DIR/Librecord.Api"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.dev.yml"
APPSETTINGS="$API_PROJECT/appsettings.Development.json"

SKIP_INFRA=false
SKIP_CERTS=false

for arg in "$@"; do
    case "$arg" in
        --skip-infra) SKIP_INFRA=true ;;
        --skip-certs) SKIP_CERTS=true ;;
        -h|--help)
            echo "Usage: ./setup-dev.sh [--skip-infra] [--skip-certs]"
            exit 0
            ;;
        *) echo "Unknown option: $arg"; exit 1 ;;
    esac
done

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

step()  { echo -e "\n${CYAN}${BOLD}[$1/$TOTAL]${NC} ${BOLD}$2${NC}"; }
ok()    { echo -e "  ${GREEN}✓${NC} $1"; }
warn()  { echo -e "  ${YELLOW}!${NC} $1"; }
fail()  { echo -e "  ${RED}✗${NC} $1"; exit 1; }
skip()  { echo -e "  ${YELLOW}→${NC} Skipped"; }

TOTAL=6

echo -e "${BOLD}"
echo "╔══════════════════════════════════════════╗"
echo "║       Librecord Dev Environment          ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ─────────────────────────────────────────────
# 1. CHECK PREREQUISITES
# ─────────────────────────────────────────────
step 1 "Checking prerequisites"

MISSING=()

if command -v docker &>/dev/null; then
    ok "docker $(docker --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1)"
    COMPOSE_CMD="docker compose"
    # Fall back to docker-compose if `docker compose` isn't available
    if ! docker compose version &>/dev/null 2>&1; then
        if command -v docker-compose &>/dev/null; then
            COMPOSE_CMD="docker-compose"
        else
            MISSING+=("docker-compose")
        fi
    fi
elif command -v podman &>/dev/null; then
    ok "podman $(podman --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' | head -1)"
    if command -v podman-compose &>/dev/null; then
        COMPOSE_CMD="podman-compose"
    else
        MISSING+=("podman-compose")
    fi
else
    MISSING+=("docker or podman")
fi

if command -v dotnet &>/dev/null; then
    ok "dotnet $(dotnet --version 2>/dev/null)"
else
    MISSING+=("dotnet (NET 10.0 SDK)")
fi

if command -v node &>/dev/null; then
    ok "node $(node --version 2>/dev/null)"
else
    MISSING+=("node (v20+)")
fi

if command -v npm &>/dev/null; then
    ok "npm $(npm --version 2>/dev/null)"
else
    MISSING+=("npm")
fi

if command -v openssl &>/dev/null; then
    ok "openssl"
else
    MISSING+=("openssl")
fi

if [ ${#MISSING[@]} -gt 0 ]; then
    echo ""
    fail "Missing required tools: ${MISSING[*]}"
fi

# ─────────────────────────────────────────────
# 2. START INFRASTRUCTURE
# ─────────────────────────────────────────────
step 2 "Starting infrastructure (PostgreSQL, MinIO, LiveKit)"

if [ "$SKIP_INFRA" = true ]; then
    skip
else
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d 2>&1 | tail -5

    # Wait for PostgreSQL to accept connections
    echo -e "  Waiting for PostgreSQL..."
    RETRIES=30
    until $COMPOSE_CMD -f "$COMPOSE_FILE" exec -T postgres pg_isready -U dev -d librecord &>/dev/null; do
        RETRIES=$((RETRIES - 1))
        if [ $RETRIES -le 0 ]; then
            fail "PostgreSQL did not become ready in time"
        fi
        sleep 1
    done

    ok "PostgreSQL ready (localhost:5432)"

    # Wait for MinIO to be ready, then create the attachment bucket
    echo -e "  Waiting for MinIO..."
    MINIO_RETRIES=15
    until curl -sf http://localhost:9000/minio/health/live &>/dev/null; do
        MINIO_RETRIES=$((MINIO_RETRIES - 1))
        if [ $MINIO_RETRIES -le 0 ]; then
            fail "MinIO did not become ready in time"
        fi
        sleep 1
    done

    # Create the attachment bucket if it doesn't exist
    docker exec librecord-minio-dev mc alias set local http://localhost:9000 minioadmin minioadmin &>/dev/null
    docker exec librecord-minio-dev mc mb local/librecord-attachments --ignore-existing &>/dev/null
    ok "MinIO bucket 'librecord-attachments' ready"

    ok "MinIO ready (localhost:9000, console :9001)"
    ok "LiveKit ready (localhost:7880)"
fi

# ─────────────────────────────────────────────
# 3. GENERATE HTTPS CERTIFICATES
# ─────────────────────────────────────────────
step 3 "Setting up HTTPS certificates"

if [ "$SKIP_CERTS" = true ]; then
    skip
elif [ -f "$CERT_KEY" ] && [ -f "$CERT_PEM" ]; then
    # Check if cert is expired
    if openssl x509 -checkend 0 -noout -in "$CERT_PEM" &>/dev/null; then
        ok "Certificates already exist and are valid"
    else
        warn "Certificates expired — regenerating"
        openssl req -x509 -newkey rsa:2048 -nodes \
            -keyout "$CERT_KEY" \
            -out "$CERT_PEM" \
            -days 365 -subj "/CN=localhost" 2>/dev/null
        ok "Regenerated certificates"
    fi
else
    mkdir -p "$CERT_DIR"
    openssl req -x509 -newkey rsa:2048 -nodes \
        -keyout "$CERT_KEY" \
        -out "$CERT_PEM" \
        -days 365 -subj "/CN=localhost" 2>/dev/null
    ok "Generated self-signed certificates in $CERT_DIR"
fi

# Update cert paths in appsettings if they point to the wrong home dir
if [ -f "$APPSETTINGS" ]; then
    CURRENT_HOME=$(grep -oP '(?<="Path": ")[^"]+' "$APPSETTINGS" | head -1 | xargs dirname | xargs dirname | xargs dirname)
    if [ "$CURRENT_HOME" != "$HOME" ] && [ -n "$CURRENT_HOME" ]; then
        sed -i "s|$CURRENT_HOME|$HOME|g" "$APPSETTINGS"
        ok "Updated certificate paths in appsettings.Development.json"
    else
        ok "Certificate paths already correct"
    fi
fi

# ─────────────────────────────────────────────
# 4. RESTORE .NET TOOLS & DEPENDENCIES
# ─────────────────────────────────────────────
step 4 "Restoring backend dependencies"

cd "$SCRIPT_DIR"

dotnet tool restore 2>&1 | grep -v "already installed" || true
ok "dotnet tools restored"

dotnet build Librecord.sln --verbosity quiet 2>&1 | tail -3
ok "Backend built successfully"

# ─────────────────────────────────────────────
# 5. RUN DATABASE MIGRATIONS
# ─────────────────────────────────────────────
step 5 "Applying database migrations"

dotnet ef database update \
    --project Librecord.Infra/Librecord.Infra.csproj \
    --startup-project Librecord.Api/Librecord.Api.csproj \
    --context Librecord.Infra.Database.LibrecordContext \
    --configuration Debug \
    --no-build 2>&1 | tail -3

ok "Database schema up to date"

# ─────────────────────────────────────────────
# 6. SET UP FRONTEND
# ─────────────────────────────────────────────
step 6 "Setting up frontend"

cd "$CLIENT_DIR"

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "VITE_API_URL=https://localhost:5111" > .env
    ok "Created .env with VITE_API_URL=https://localhost:5111"
else
    ok ".env already exists"
fi

npm install --silent 2>&1 | tail -3
ok "npm dependencies installed"

# ─────────────────────────────────────────────
# DONE
# ─────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║          Setup complete!                 ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Start the backend:   ${CYAN}dotnet run --project Librecord.Api${NC}"
echo -e "  Start the frontend:  ${CYAN}cd Librecord.Client && npm run dev${NC}"
echo ""
echo -e "  ${BOLD}Backend${NC}   → https://localhost:5111"
echo -e "  ${BOLD}Frontend${NC}  → https://localhost:5173"
echo -e "  ${BOLD}Swagger${NC}   → https://localhost:5111/swagger"
echo -e "  ${BOLD}MinIO${NC}     → http://localhost:9001  (minioadmin/minioadmin)"
echo ""
echo -e "  ${YELLOW}Note:${NC} Accept the self-signed cert in your browser for both ports."
echo ""
