#!/bin/bash
###############################################################################
# ValueOS DevContainer Post-Create Hook
#
# This script runs after the devcontainer is created.
# It installs dependencies and starts the development environment.
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🚀 Starting ValueOS Post-Create Setup..."
echo ""

###############################################################################
# Step 1: Install Dependencies (Idempotent) - MOVED TO DOCKERFILE
###############################################################################
echo "✅ Dependencies installed in Dockerfile. Skipping pnpm install."

###############################################################################
# Step 2: Ensure .env.local exists
###############################################################################
if [ ! -f "${PROJECT_ROOT}/.env.local" ]; then
    if [ -f "${PROJECT_ROOT}/.devcontainer/.env.dev" ]; then
        echo "📄 Copying .env.dev to .env.local..."
        cp "${PROJECT_ROOT}/.devcontainer/.env.dev" "${PROJECT_ROOT}/.env.local"
    elif [ -f "${PROJECT_ROOT}/.env.example" ]; then
        echo "📄 Copying .env.example to .env.local..."
        cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env.local"
    fi
fi

# Load environment variables
if [ -f "${PROJECT_ROOT}/.env.local" ]; then
    echo "📄 Loading .env.local..."
    set -a
    source "${PROJECT_ROOT}/.env.local"
    set +a

    # Convert host-based DATABASE_URL to container network URL for migrations
    if [ -n "$DATABASE_URL" ]; then
        ORIGINAL_URL="$DATABASE_URL"
        DATABASE_URL=$(echo "$DATABASE_URL" | sed 's/localhost:54322/postgres:5432/')
        echo "🔄 Context-aware DATABASE_URL: $DATABASE_URL"
    fi
fi

###############################################################################
# Step 3: Start runtime services (single entrypoint)
###############################################################################
echo "🐳 Starting runtime services via ./scripts/dc up -d..."
"${PROJECT_ROOT}/scripts/dc" up -d

###############################################################################
# Step 4: Wait for Database (using same connection params as migrations)
###############################################################################
echo "⏳ Waiting for database to be ready..."

# Use DATABASE_URL if set (from devcontainer), otherwise resolve dynamically
if [ -n "$DATABASE_URL" ]; then
    DB_URL="$DATABASE_URL"
    echo "   Using DATABASE_URL from environment: $DB_URL"
else
    # Resolve DB host dynamically - try Docker DNS, fall back to container IP
    resolve_db_host() {
        if getent hosts postgres >/dev/null 2>&1; then
            echo "postgres"
            return
        fi
        if getent hosts valueos-postgres >/dev/null 2>&1; then
            echo "valueos-postgres"
            return
        fi
        if command -v docker >/dev/null 2>&1; then
            local ip=$(docker inspect valueos-postgres-1 --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null)
            if [[ -n "$ip" ]]; then
                echo "$ip"
                return
            fi
        fi
        echo "postgres"
    }

    DB_HOST=$(resolve_db_host)
    DB_URL="postgresql://postgres:postgres@${DB_HOST}:5432/postgres?sslmode=disable"
    echo "   Using DB: ${DB_HOST}:5432"
fi

# Wait for db container to be healthy (only when Docker CLI + daemon are available).
# If Docker tooling is missing or unavailable, continue with in-network checks below.
if command -v docker >/dev/null 2>&1; then
    if docker info >/dev/null 2>&1; then
        echo "   Waiting for db container to be healthy..."
        MAX_CONTAINER_ATTEMPTS=30
        CONTAINER_ATTEMPT=0
        while [ $CONTAINER_ATTEMPT -lt $MAX_CONTAINER_ATTEMPTS ]; do
            if docker ps --filter "name=db" --filter "health=healthy" | grep -q db; then
                echo "   ✅ DB container is healthy."
                break
            fi
            CONTAINER_ATTEMPT=$((CONTAINER_ATTEMPT + 1))
            echo "   Attempt $CONTAINER_ATTEMPT/$MAX_CONTAINER_ATTEMPTS - waiting for db container..."
            sleep 2
        done

        if [ $CONTAINER_ATTEMPT -eq $MAX_CONTAINER_ATTEMPTS ]; then
            echo "⚠️  DB container health check timed out; falling back to network readiness checks."
        fi
    else
        echo "⚠️  Docker daemon is unavailable; skipping container health check."
    fi
else
    echo "⚠️  Docker CLI not available; skipping container health check."
fi
MAX_ATTEMPTS=30
ATTEMPT=0

# Readiness strategy matches scripts/dev/start-dev-env.sh:
#   1) Prefer a direct SQL probe with psql when present.
#   2) If psql (or Docker tooling) is missing/unavailable, fall back to pg_isready,
#      then nc, then curl against PostgREST (rest:3000).
# Missing tools are treated as soft warnings so devcontainer setup can continue.
PSQL_AVAILABLE=true
if ! command -v psql >/dev/null 2>&1; then
    PSQL_AVAILABLE=false
    echo "⚠️  psql not available; using fallback readiness checks."
fi

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if [ "$PSQL_AVAILABLE" = "true" ] && psql "$DB_URL" -c "SELECT 1" >/dev/null 2>&1; then
        echo "✅ Database is ready (verified with sslmode=disable)."
        break
    fi
    if command -v pg_isready >/dev/null 2>&1 && pg_isready -h "${DB_HOST:-db}" -U postgres -d postgres >/dev/null 2>&1; then
        echo "✅ Database is ready (verified with pg_isready)."
        break
    fi
    if command -v nc >/dev/null 2>&1 && nc -z "${DB_HOST:-db}" 5432 >/dev/null 2>&1; then
        echo "✅ Database is reachable on port 5432."
        break
    fi
    if command -v curl >/dev/null 2>&1 && curl -s --max-time 2 "http://rest:3000/" >/dev/null 2>&1; then
        echo "✅ PostgREST is responding; database is ready."
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "   Attempt $ATTEMPT/$MAX_ATTEMPTS - waiting for db:5432..."
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "❌ Error: Database not ready after $MAX_ATTEMPTS attempts."
    echo "   Cannot proceed with migrations."
    exit 1
fi

###############################################################################
# Step 5: Apply Migrations (required - fail if migrations fail)
###############################################################################
echo "🔄 Applying database migrations..."

# Ensure database environment variables are set for migration scripts
export PGHOST="${DB_HOST:-db}"
export DB_HOST="${DB_HOST:-db}"
export DB_PASSWORD="${DB_PASSWORD:-postgres}"
export DB_NAME="${DB_NAME:-postgres}"

echo "   Using DB_HOST: $DB_HOST"
echo "   Using DB_NAME: $DB_NAME"

if ! bash "${SCRIPT_DIR}/migrate.sh"; then
    echo "❌ Migration failed. Development environment is NOT ready."
    echo "   Run 'bash scripts/dev/migrate.sh --debug' for details."
    exit 1
fi
echo "✅ Migrations applied successfully."

###############################################################################
# Step 6: Optional Seed
###############################################################################
if [ "${DEV_SEED:-0}" = "1" ]; then
    echo "🌱 Seeding database..."
    cd "$PROJECT_ROOT"
    pnpm run seed:demo || echo "⚠️ Seed warning (may be OK if already seeded)"
fi

###############################################################################
# Done!
###############################################################################
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         🎉 Development environment ready!                      ║"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║                                                                ║"
echo "║  Start dev server:  pnpm dev                                   ║"
echo "║                                                                ║"
echo "║  Endpoints:                                                    ║"
echo "║    App:    http://localhost:5173                               ║"
echo "║    API:    http://localhost:54321                              ║"
echo "║    Studio: http://localhost:54323                              ║"
echo "║                                                                ║"
echo "║  Diagnostics: bash scripts/dev/diagnostics.sh                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
