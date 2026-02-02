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
# Step 1: Install Dependencies (Idempotent)
###############################################################################
DEPS_MARKER="${PROJECT_ROOT}/.deps_installed"

if [ -f "$DEPS_MARKER" ]; then
    echo "✅ Dependencies already installed. Skipping pnpm install."
else
    echo "📦 Installing dependencies..."
    cd "$PROJECT_ROOT"
    pnpm install --frozen-lockfile || pnpm install
    touch "$DEPS_MARKER"
    echo "✅ Dependencies installed."
fi

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

###############################################################################
# Step 3: Wait for Database (using same connection params as migrations)
###############################################################################
echo "⏳ Waiting for database to be ready..."

# Resolve DB host dynamically - try Docker DNS, fall back to container IP
resolve_db_host() {
    if getent hosts valueos-db >/dev/null 2>&1; then
        echo "valueos-db"
        return
    fi
    if getent hosts db >/dev/null 2>&1; then
        echo "db"
        return
    fi
    if command -v docker >/dev/null 2>&1; then
        local ip=$(docker inspect valueos-db --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null)
        if [[ -n "$ip" ]]; then
            echo "$ip"
            return
        fi
    fi
    echo "db"
}

DB_HOST=$(resolve_db_host)
DB_URL="postgresql://postgres:postgres@${DB_HOST}:5432/postgres?sslmode=disable"
echo "   Using DB: ${DB_HOST}:5432"
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if psql "$DB_URL" -c "SELECT 1" >/dev/null 2>&1; then
        echo "✅ Database is ready (verified with sslmode=disable)."
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
# Step 4: Apply Migrations (required - fail if migrations fail)
###############################################################################
echo "🔄 Applying database migrations..."
if ! bash "${SCRIPT_DIR}/migrate.sh"; then
    echo "❌ Migration failed. Development environment is NOT ready."
    echo "   Run 'bash scripts/dev/migrate.sh --debug' for details."
    exit 1
fi
echo "✅ Migrations applied successfully."

###############################################################################
# Step 5: Optional Seed
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
