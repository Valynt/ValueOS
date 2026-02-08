#!/usr/bin/env bash
set -euo pipefail

echo "Installing Playwright browsers and deps (non-fatal)..."

if command -v pnpm >/dev/null 2>&1; then
  pnpm install --frozen-lockfile || true
  pnpm playwright install --with-deps || true
else
  echo "pnpm not found; skipping playwright install"
fi

echo "Playwright install step complete."
