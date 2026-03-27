#!/usr/bin/env bash
###############################################################################
# ValueOS Cloud-Dev Init — one-time project bootstrap
#
# Verifies tools, copies env templates, generates local secrets, installs
# dependencies, validates the environment, and runs database migrations.
#
# Usage:
#   bash scripts/dev/init-cloud-dev.sh          # or: pnpm dev:init
#
# Prerequisites:
#   Fill Supabase credentials in the env files BEFORE running this script:
#     ops/env/.env.cloud-dev            → SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PROJECT_REF
#     ops/env/.env.backend.cloud-dev    → SUPABASE_SERVICE_ROLE_KEY, SUPABASE_KEY, DATABASE_URL
#     ops/env/.env.frontend.cloud-dev   → SUPABASE_URL, SUPABASE_ANON_KEY
#
# After init: pnpm dev:up
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

info()  { echo -e "${CYAN}[init]${NC} $*"; }
ok()    { echo -e "${GREEN}[init]${NC} $*"; }
warn()  { echo -e "${YELLOW}[init]${NC} $*"; }
fail()  { echo -e "${RED}[init]${NC} $*" >&2; exit 1; }

# ── Step 1/7: Check tools ──────────────────────────────────────────────────
info "${BOLD}[1/7] Checking tools...${NC}"

command -v node  >/dev/null 2>&1 || fail "node not found. Install Node.js >= 20."
command -v pnpm  >/dev/null 2>&1 || fail "pnpm not found. Install with: npm install -g pnpm"

if command -v psql >/dev/null 2>&1; then
  ok "psql found"
else
  warn "psql not found — DB connectivity checks will be skipped"
fi

ok "node $(node --version), pnpm $(pnpm --version)"

# ── Step 2/7: Create env files if missing ───────────────────────────────────
info "${BOLD}[2/7] Creating env files if missing...${NC}"

copy_if_missing() {
  local src="$1" dst="$2"
  if [[ ! -f "$dst" ]]; then
    if [[ -f "$src" ]]; then
      cp "$src" "$dst"
      ok "Created $(basename "$dst") from template"
    else
      warn "Template not found: $src"
    fi
  else
    ok "$(basename "$dst") already exists"
  fi
}

copy_if_missing ops/env/.env.cloud-dev.example          ops/env/.env.cloud-dev
copy_if_missing ops/env/.env.frontend.cloud-dev.example  ops/env/.env.frontend.cloud-dev
copy_if_missing ops/env/.env.backend.cloud-dev.example   ops/env/.env.backend.cloud-dev

# ── Step 3/7: Generate secrets if missing ───────────────────────────────────
info "${BOLD}[3/7] Generating secrets if missing...${NC}"

BACKEND_ENV="ops/env/.env.backend.cloud-dev"

inject_secret() {
  local key="$1" value="$2"
  # Check if the key already has a real (non-placeholder) value
  local current
  current="$(grep "^${key}=" "$BACKEND_ENV" 2>/dev/null | head -1 | cut -d= -f2-)" || true

  case "$current" in
    ""|change-me|your-*)
      # Replace the placeholder line or append
      if grep -q "^${key}=" "$BACKEND_ENV" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$BACKEND_ENV"
      else
        echo "${key}=${value}" >> "$BACKEND_ENV"
      fi
      ok "Generated ${key}"
      ;;
    *)
      ok "${key} already set"
      ;;
  esac
}

inject_secret TCT_SECRET "$(openssl rand -hex 32)"
inject_secret WEB_SCRAPER_ENCRYPTION_KEY "$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"

# ── Step 4/7: Install dependencies ─────────────────────────────────────────
info "${BOLD}[4/7] Installing dependencies...${NC}"
pnpm install --frozen-lockfile || pnpm install

# ── Step 5/7: Validate env ─────────────────────────────────────────────────
info "${BOLD}[5/7] Validating env...${NC}"
bash scripts/validate-cloud-dev-env.sh

# ── Step 6/7: Run migrations ───────────────────────────────────────────────
info "${BOLD}[6/7] Running database migrations...${NC}"

set -a
# shellcheck disable=SC1091
source ops/env/.env.cloud-dev
# shellcheck disable=SC1091
source ops/env/.env.backend.cloud-dev
set +a

ALLOW_REMOTE_DB_MIGRATIONS=true pnpm run db:migrate

# ── Step 7/7: Done ─────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Cloud-dev init complete!${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════${NC}"
echo ""
echo -e "  Next: ${CYAN}pnpm dev:up${NC}"
echo ""
echo -e "  If you still need to fill in Supabase credentials,"
echo -e "  edit these files and re-run ${CYAN}pnpm dev:init${NC}:"
echo -e "    ops/env/.env.cloud-dev"
echo -e "    ops/env/.env.backend.cloud-dev"
echo -e "    ops/env/.env.frontend.cloud-dev"
echo ""
