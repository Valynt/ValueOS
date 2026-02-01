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
# Step 3: Wait for Database
###############################################################################
echo "⏳ Waiting for database to be ready..."

MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if PGPASSWORD=postgres psql -h db -U postgres -c '\q' 2>/dev/null; then
        echo "✅ Database is ready."
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "   Attempt $ATTEMPT/$MAX_ATTEMPTS - waiting for db:5432..."
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "⚠️ Warning: Database not ready after $MAX_ATTEMPTS attempts."
    echo "   Continuing anyway - migrations may fail."
fi

###############################################################################
# Step 4: Apply Migrations
###############################################################################
echo "🔄 Applying database migrations..."
bash "${SCRIPT_DIR}/migrate.sh" || echo "⚠️ Migration warning (may be OK if already applied)"

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
