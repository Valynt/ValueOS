#!/usr/bin/env bash
set -euo pipefail

# Ensure a project-level .env exists so `docker compose` interpolation succeeds for the DevContainer.
# Usage: bash .devcontainer/scripts/ensure-dotenv.sh

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/ops/env/.env.local"
DEST="$ROOT/.env"

if [[ -f "$DEST" ]]; then
  echo "✅ .env already exists at $DEST — no changes made."
  exit 0
fi

if [[ ! -f "$SRC" ]]; then
  echo "❌ Source env file not found: $SRC" >&2
  echo "Run: pnpm run dx:env --mode local --force" >&2
  exit 1
fi

cp "$SRC" "$DEST"
chmod 600 "$DEST" 2>/dev/null || true

echo "✅ Created $DEST from $SRC (safe, gitignored)."
echo "Next: Reopen the repository in the DevContainer (VS Code → Dev Containers: Reopen in Container)."
