#!/usr/bin/env bash
set -euo pipefail

log() { printf '[bootstrap] %s\n' "$*" >&2; }
warn() { printf '[bootstrap][WARN] %s\n' "$*" >&2; }
die() { printf '[bootstrap][ERROR] %s\n' "$*" >&2; exit 1; }

# shellcheck source=/dev/null
source ".devcontainer/scripts/env-setup.sh"

: "${WORKSPACE_FOLDER:?WORKSPACE_FOLDER is not set}"
[[ -d "$WORKSPACE_FOLDER" ]] || die "Workspace not found: $WORKSPACE_FOLDER"
cd "$WORKSPACE_FOLDER"

[[ -d .git ]] || die "Missing .git in workspace (${WORKSPACE_FOLDER})"

log "Ensuring local env file exists for compose interpolation"
bash .devcontainer/scripts/ensure-dotenv.sh

log "Loading environment files"
load_environment
validate_env

log "Running basic network diagnostics"
getent hosts github.com >/dev/null 2>&1 || warn "DNS lookup for github.com failed"
getent hosts registry.npmjs.org >/dev/null 2>&1 || warn "DNS lookup for registry.npmjs.org failed"

log "Verifying pinned pnpm version"
verify_pnpm

log "Installing dependencies"
if [[ -f pnpm-lock.yaml ]]; then
  pnpm install --frozen-lockfile
else
  pnpm install
fi

MIGRATION_MODE="${DX_DB_MODE:-local}"
log "Applying migrations in '${MIGRATION_MODE}' mode"
if [[ "$MIGRATION_MODE" == "local" ]]; then
  pnpm run db:apply-migrations || warn "Local migrations failed"
elif [[ "$MIGRATION_MODE" == "cloud" ]]; then
  if [[ -f scripts/migrate.sh ]]; then
    pnpm run db:migrate || warn "Cloud migration command failed"
  else
    warn "scripts/migrate.sh not found; skipping cloud migrations"
  fi
else
  warn "Unknown DX_DB_MODE='$MIGRATION_MODE'; skipping migrations"
fi

log "Running devcontainer doctor"
bash .devcontainer/scripts/doctor.sh || warn "doctor checks reported issues"

log "Bootstrap complete"
