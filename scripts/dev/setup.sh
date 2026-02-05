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
        DATABASE_URL=$(echo "$DATABASE_URL" | sed 's/localhost:54322/db:5432/')
        echo "🔄 Context-aware DATABASE_URL: $DATABASE_URL"
    fi
fi

###############################################################################
# Step 3: Configure Database Connection
###############################################################################
# Trust the orchestrator: app depends on db (service_healthy), so DB is ready.

# Set DB_HOST for migration scripts
export DB_HOST="${DB_HOST:-db}"
echo "   Using DB_HOST: $DB_HOST"

###############################################################################
# Step 4: Apply Migrations (via Supabase CLI)
###############################################################################
echo "🔄 Applying database migrations (Supabase)..."

# Ensure Supabase CLI uses the correct DB URL and SSL mode
export PGSSLMODE=disable
echo "   Using DB_URL: $DB_URL"

# We use --workdir infra/supabase to point to the correct configuration
if ! supabase db push --yes --workdir infra/supabase --db-url "$DB_URL"; then
    echo "❌ Migration failed. Development environment is NOT ready."
    echo "   Check Supabase CLI output above."
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
# Step 6: Optional UI Seed (local fixtures for UI states)
###############################################################################
if [ "${UI_SEED:-0}" = "1" ]; then
    echo "🎨 Seeding UI fixtures..."
    bash "${SCRIPT_DIR}/seed-ui.sh"
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
