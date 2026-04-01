#!/usr/bin/env bash
# bootstrap.sh — idempotent dev environment setup
#
# Safe to run multiple times. Each step checks before acting.
# Called by the installDeps automation (postDevcontainerStart).
# Can also be run manually: bash .devcontainer/scripts/bootstrap.sh
#
# Steps:
#   1. Validate toolchain versions
#   2. Ensure .env exists (from template if needed)
#   3. Validate required devcontainer secrets
#   4. Install workspace dependencies (frozen lockfile)
#   5. Smoke-test: confirm node_modules sentinel is present
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VERSIONS_FILE="${ROOT}/.devcontainer/versions.json"
# shellcheck source=.devcontainer/scripts/env-setup.sh
source "${SCRIPT_DIR}/env-setup.sh"

log()  { printf '[bootstrap] %s\n' "$*"; }
warn() { printf '[bootstrap] WARN: %s\n' "$*" >&2; }
die()  { printf '[bootstrap] ERROR: %s\n' "$*" >&2; exit 1; }

cd "${ROOT}"

# ── 1. Validate toolchain ─────────────────────────────────────────────────────
log "Validating toolchain..."

[[ -f "${VERSIONS_FILE}" ]] || die "versions.json not found at ${VERSIONS_FILE}"

read_version() {
  node -e "
    const d = JSON.parse(require('fs').readFileSync('${VERSIONS_FILE}', 'utf8'));
    if (!d['$1']) { process.stderr.write('Missing key: $1\n'); process.exit(1); }
    process.stdout.write(String(d['$1']));
  "
}

EXPECTED_NODE="$(read_version node)"
EXPECTED_PNPM="$(read_version pnpm)"

ACTUAL_NODE="$(node --version | sed 's/^v//')"
ACTUAL_PNPM="$(pnpm --version 2>/dev/null || echo 'missing')"

if [[ "${ACTUAL_NODE}" != "${EXPECTED_NODE}" ]]; then
  warn "Node version mismatch: expected ${EXPECTED_NODE}, got ${ACTUAL_NODE}"
  warn "Rebuild the container to get the correct Node version."
else
  log "node ${ACTUAL_NODE} ✓"
fi

if [[ "${ACTUAL_PNPM}" != "${EXPECTED_PNPM}" ]]; then
  warn "pnpm version mismatch: expected ${EXPECTED_PNPM}, got ${ACTUAL_PNPM}"
else
  log "pnpm ${ACTUAL_PNPM} ✓"
fi

for tool in git curl jq; do
  command -v "${tool}" >/dev/null 2>&1 || die "${tool} not found — rebuild the container"
  log "${tool} $(${tool} --version 2>&1 | head -1) ✓"
done

# ── 2. Ensure .env exists ─────────────────────────────────────────────────────
log "Checking .env..."

ENV_DEST="${ROOT}/.env"
ENV_SRC="${ROOT}/ops/env/.env.local"

# Generate ops/env/.env.local from Ona-injected secrets if it doesn't exist yet.
if [[ ! -f "${ENV_SRC}" ]]; then
  log "ops/env/.env.local not found — generating from injected secrets..."
  bash "${SCRIPT_DIR}/generate-env-from-secrets.sh"
fi

# Propagate to the root .env consumed by docker compose and other tooling.
bash "${SCRIPT_DIR}/ensure-dotenv.sh"

# ── 3. Validate startup secrets ─────────────────────────────────────────────
if [[ -x "${ROOT}/.devcontainer/scripts/validate-devcontainer-secrets.sh" ]] && [[ -f "${ENV_DEST}" ]]; then
  log "Validating devcontainer secrets..."
  load_kv_file "${ENV_DEST}"
  "${ROOT}/.devcontainer/scripts/validate-devcontainer-secrets.sh"
fi

# ── 4. Install workspace dependencies ────────────────────────────────────────
log "Installing workspace dependencies..."

# Remove an incomplete node_modules left by a previously interrupted install.
if [[ -d node_modules/.pnpm ]] && [[ ! -f node_modules/.modules.yaml ]]; then
  log "Incomplete node_modules detected — removing before reinstall."
  rm -rf node_modules
fi

if [[ -f node_modules/.modules.yaml ]]; then
  log "node_modules already installed — skipping (run 'pnpm install' to update)"
else
  CI=true pnpm install --frozen-lockfile
fi

# ── 5. Smoke test ─────────────────────────────────────────────────────────────
log "Verifying install..."

[[ -f node_modules/.modules.yaml ]] \
  || die "node_modules/.modules.yaml missing after install — pnpm install may have failed"

# turbo and tsx must be resolvable as workspace devDependencies
pnpm --filter . exec turbo --version >/dev/null 2>&1 \
  || warn "turbo not resolvable — run 'pnpm install' to fix"

pnpm --filter . exec tsx --version >/dev/null 2>&1 \
  || warn "tsx not resolvable — run 'pnpm install' to fix"

log "Bootstrap complete."
