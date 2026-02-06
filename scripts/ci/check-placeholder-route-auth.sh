#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

PATTERN='const requireAuth = \(_req.*next\) => next\(\);?'
TARGET='packages/backend/src/api'

if rg -n --glob '*.ts' --glob '!**/__tests__/**' --glob '!**/*.test.ts' --glob '!**/*.spec.ts' "$PATTERN" "$TARGET"; then
  echo "❌ Placeholder auth middleware detected in API route modules. Import requireAuth from middleware/auth.js instead." >&2
  exit 1
fi

echo "✅ No placeholder requireAuth middleware found in API route modules."
