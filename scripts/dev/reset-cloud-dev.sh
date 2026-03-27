#!/usr/bin/env bash
###############################################################################
# ValueOS Cloud-Dev Reset — re-run migrations, clear caches, restart
#
# Use this when you need to resync migrations, clear stale state, or recover
# from a broken local environment without a full re-init.
#
# Usage:
#   bash scripts/dev/reset-cloud-dev.sh         # or: pnpm dev:reset
###############################################################################
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

export APP_ENV=cloud-dev

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

info()  { echo -e "${CYAN}[reset]${NC} $*"; }
ok()    { echo -e "${GREEN}[reset]${NC} $*"; }
warn()  { echo -e "${YELLOW}[reset]${NC} $*"; }

# ── Load env ────────────────────────────────────────────────────────────────
info "Loading env..."
set -a
# shellcheck disable=SC1091
source ops/env/.env.cloud-dev
# shellcheck disable=SC1091
source ops/env/.env.backend.cloud-dev
set +a

# ── Re-run migrations ──────────────────────────────────────────────────────
info "${BOLD}[1/3] Re-running migrations...${NC}"
ALLOW_REMOTE_DB_MIGRATIONS=true pnpm run db:migrate
ok "Migrations complete"

# ── Clear local caches ─────────────────────────────────────────────────────
info "${BOLD}[2/3] Clearing local caches...${NC}"

rm -f .dx-lock .dx-state.json
rm -rf node_modules/.cache
rm -rf apps/ValyntApp/node_modules/.vite
ok "Caches cleared"

# ── Restart services ────────────────────────────────────────────────────────
info "${BOLD}[3/3] Restarting services...${NC}"
exec bash "$ROOT/scripts/dev/up-cloud-dev.sh"
