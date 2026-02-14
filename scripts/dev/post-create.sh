#!/bin/bash
###############################################################################
# ValueOS DevContainer Post-Create Hook
#
# Canonical setup delegates readiness + migrations to start-dev-env.sh.
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🚀 Starting ValueOS Post-Create Setup..."
echo ""

###############################################################################
# Step 1: Ensure .env.local exists
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
# Step 2: Load environment variables and normalize service DNS for container mode
###############################################################################
if [ -f "${PROJECT_ROOT}/.env.local" ]; then
    echo "📄 Loading .env.local..."
    set -a
    source "${PROJECT_ROOT}/.env.local"
    set +a

    if [ -n "${DATABASE_URL:-}" ]; then
        DATABASE_URL=$(echo "$DATABASE_URL" | sed -E 's/localhost:(54322|5432)/postgres:5432/')
        export DATABASE_URL
        echo "🔄 Context-aware DATABASE_URL: $DATABASE_URL"
    fi
fi

export DB_HOST="${DB_HOST:-postgres}"
export REDIS_HOST="${REDIS_HOST:-redis}"

###############################################################################
# Step 3: Canonical readiness + migration flow
###############################################################################
echo "🧭 Running canonical readiness flow..."
bash "${SCRIPT_DIR}/start-dev-env.sh"

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
echo "║  Diagnostics: bash scripts/dev/diagnostics.sh                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
