#!/usr/bin/env bash
set -euo pipefail

# Ensure a project-level .env exists so `docker compose` interpolation succeeds for the DevContainer.
# Usage: bash .devcontainer/scripts/ensure-dotenv.sh

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/ops/env/.env.local"
DEST="$ROOT/.env"
TEMPLATE="$ROOT/.devcontainer/.env.template"

# If .env already exists, we're done
if [[ -f "$DEST" ]]; then
  echo "✅ .env already exists at $DEST — no changes made."
  exit 0
fi

# Try to create from ops/env/.env.local (preferred)
if [[ -f "$SRC" ]]; then
  cp "$SRC" "$DEST"
  chmod 600 "$DEST" 2>/dev/null || true
  echo "✅ Created $DEST from ops/env/.env.local"
  exit 0
fi

# Fallback: create from template with warnings
if [[ -f "$TEMPLATE" ]]; then
  cp "$TEMPLATE" "$DEST"
  chmod 600 "$DEST" 2>/dev/null || true
  echo "⚠️  Created $DEST from template (REVIEW AND CUSTOMIZE!)"
  echo "⚠️  The template contains default/placeholder secrets."
  echo "⚠️  Run: pnpm run dx:env --mode local --force for proper secrets"
  exit 0
fi

echo "❌ No env source available (tried: $SRC, $TEMPLATE)" >&2
exit 1
