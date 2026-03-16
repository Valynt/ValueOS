#!/usr/bin/env bash
# Shared helpers for devcontainer scripts. Must be sourced, not executed.
# Provides: log, die, load_kv_file, verify_pnpm
set -euo pipefail

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "[env-setup] ERROR: This file must be sourced, not executed." >&2
  exit 1
fi

log() { printf '[env-setup] %s\n' "$*" >&2; }
die() { printf '[env-setup][ERROR] %s\n' "$*" >&2; exit 1; }

# Safe KEY=VALUE file loader — ignores comments, blank lines, and shell code.
load_kv_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  log "Loading env from $file"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    line="${line#export }"
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      local key="${line%%=*}"
      local val="${line#*=}"
      if [[ "$val" =~ ^\".*\"$ ]]; then val="${val:1:-1}"; fi
      if [[ "$val" =~ ^\'.*\'$ ]]; then val="${val:1:-1}"; fi
      export "$key=$val"
    fi
  done < "$file"
}

verify_pnpm() {
  local pnpm_version="10.4.1"
  if [[ -x .devcontainer/scripts/read-version.sh ]]; then
    pnpm_version="$(.devcontainer/scripts/read-version.sh pnpm 2>/dev/null || echo "$pnpm_version")"
  fi
  command -v corepack >/dev/null 2>&1 || die "corepack not found"
  corepack enable >/dev/null 2>&1 || true
  corepack prepare "pnpm@${pnpm_version}" --activate >/dev/null 2>&1 || true
  command -v pnpm >/dev/null 2>&1 || die "pnpm not available after corepack activation"
  log "pnpm ready: $(pnpm --version)"
}
