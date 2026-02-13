#!/usr/bin/env bash
set -euo pipefail

PNPM_VERSION=${PNPM_VERSION:-"9.15.0"}

log() { echo "[ensure-pnpm] $*"; }

# If pnpm already exists, do nothing
if command -v pnpm >/dev/null 2>&1; then
  log "pnpm found: $(pnpm -v)"
  exit 0
fi

# Prefer Corepack when available
if command -v corepack >/dev/null 2>&1; then
  log "Enabling Corepack and preparing pnpm@${PNPM_VERSION}"
  corepack enable || true
  corepack prepare pnpm@${PNPM_VERSION} --activate || true
  if command -v pnpm >/dev/null 2>&1; then
    log "pnpm ready: $(pnpm -v)"
    exit 0
  fi
fi

# Fallback to npm global install when available
if command -v npm >/dev/null 2>&1; then
  log "Corepack not available; installing pnpm@${PNPM_VERSION} via npm"
  npm install -g pnpm@${PNPM_VERSION} >/dev/null 2>&1 || true
  if command -v pnpm >/dev/null 2>&1; then
    log "pnpm installed: $(pnpm -v)"
    exit 0
  fi
fi

log "ERROR: Could not install or activate pnpm. Please install pnpm manually or ensure Corepack is available."
exit 1
