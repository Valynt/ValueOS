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
#   3. Install workspace dependencies (frozen lockfile)
#   4. Smoke-test: confirm node_modules sentinel is present
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VERSIONS_FILE="${ROOT}/.devcontainer/versions.json"

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
ENV_TEMPLATE="${ROOT}/.devcontainer/.env.template"

if [[ -f "${ENV_DEST}" ]]; then
  log ".env already present — skipping"
elif [[ -f "${ENV_SRC}" ]]; then
  cp "${ENV_SRC}" "${ENV_DEST}"
  chmod 600 "${ENV_DEST}"
  log ".env created from ops/env/.env.local"
elif [[ -f "${ENV_TEMPLATE}" ]]; then
  cp "${ENV_TEMPLATE}" "${ENV_DEST}"
  chmod 600 "${ENV_DEST}"
  warn ".env created from template — review and set real secrets before starting services"
else
  warn "No .env source found. Create ${ENV_DEST} manually before starting services."
fi

# ── 3. Install workspace dependencies ────────────────────────────────────────
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

# ── 4. Smoke test ─────────────────────────────────────────────────────────────
log "Verifying install..."

[[ -f node_modules/.modules.yaml ]] \
  || die "node_modules/.modules.yaml missing after install — pnpm install may have failed"

# turbo and tsx must be resolvable as workspace devDependencies
pnpm --filter . exec turbo --version >/dev/null 2>&1 \
  || warn "turbo not resolvable — run 'pnpm install' to fix"

pnpm --filter . exec tsx --version >/dev/null 2>&1 \
  || warn "tsx not resolvable — run 'pnpm install' to fix"

log "Bootstrap complete."
