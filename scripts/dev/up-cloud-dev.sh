#!/usr/bin/env bash
###############################################################################
# ValueOS Cloud-Dev Up — daily startup
#
# Validates the environment, tests database connectivity, derives Gitpod/Ona
# URLs if WORKSPACE_HOST is set, and launches backend + frontend together.
#
# Usage:
#   bash scripts/dev/up-cloud-dev.sh            # or: pnpm dev:up
#
# Prerequisites:
#   Run pnpm dev:init at least once.
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

info()  { echo -e "${CYAN}[up]${NC} $*"; }
ok()    { echo -e "${GREEN}[up]${NC} $*"; }
warn()  { echo -e "${YELLOW}[up]${NC} $*"; }
fail()  { echo -e "${RED}[up]${NC} $*" >&2; exit 1; }

# ── Validate environment ────────────────────────────────────────────────────
info "Validating environment..."
bash scripts/validate-cloud-dev-env.sh

# ── Load env files ──────────────────────────────────────────────────────────
info "Loading env..."
set -a
# shellcheck disable=SC1091
source ops/env/.env.cloud-dev
# shellcheck disable=SC1091
source ops/env/.env.backend.cloud-dev
# shellcheck disable=SC1091
[[ -f ops/env/.env.frontend.cloud-dev ]] && source ops/env/.env.frontend.cloud-dev
set +a

# ── Derive URLs from WORKSPACE_HOST (Gitpod / Ona) ─────────────────────────
# If WORKSPACE_HOST is set, automatically compute origins so the operator
# doesn't need to copy/paste the same Gitpod URL into three separate files.
if [[ -n "${WORKSPACE_HOST:-}" ]]; then
  info "Detected WORKSPACE_HOST — deriving URLs..."
  export FRONTEND_PORT="${FRONTEND_PORT:-5173}"
  export BACKEND_PORT="${BACKEND_PORT:-3001}"

  export FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-https://${FRONTEND_PORT}-${WORKSPACE_HOST}}"
  export BACKEND_ORIGIN="${BACKEND_ORIGIN:-https://${BACKEND_PORT}-${WORKSPACE_HOST}}"
  export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-$FRONTEND_ORIGIN}"
  export API_BASE_URL="${API_BASE_URL:-$BACKEND_ORIGIN}"
  ok "FRONTEND_ORIGIN=$FRONTEND_ORIGIN"
  ok "BACKEND_ORIGIN=$BACKEND_ORIGIN"
fi

# ── Test database connectivity ──────────────────────────────────────────────
if [[ -n "${DATABASE_URL:-}" ]]; then
  info "Testing database connectivity..."
  if command -v psql >/dev/null 2>&1; then
    if psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
      ok "Database reachable"
    else
      warn "Could not connect to database — check DATABASE_URL"
    fi
  else
    warn "psql not installed — skipping DB connectivity check"
  fi
fi

# ── Optional Redis check ───────────────────────────────────────────────────
if [[ -n "${REDIS_URL:-}" ]]; then
  if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1; then
      ok "Redis reachable"
    else
      warn "Redis not reachable (optional) — app will degrade gracefully"
    fi
  fi
fi

# ── Launch backend + frontend ───────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Starting cloud-dev services${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════${NC}"
echo ""
echo -e "  Frontend:  ${CYAN}${FRONTEND_ORIGIN:-http://localhost:${FRONTEND_PORT:-5173}}${NC}"
echo -e "  Backend:   ${CYAN}${BACKEND_ORIGIN:-http://localhost:${BACKEND_PORT:-3001}}${NC}"
echo -e "  Health:    ${CYAN}${BACKEND_ORIGIN:-http://localhost:${BACKEND_PORT:-3001}}/health${NC}"
echo ""
echo -e "  Press ${BOLD}Ctrl+C${NC} to stop both services."
echo ""

# Cleanup child processes on exit
trap 'kill 0 2>/dev/null; exit' INT TERM EXIT

APP_ENV=cloud-dev pnpm run dev:backend &
APP_ENV=cloud-dev pnpm run dev:frontend &

wait
