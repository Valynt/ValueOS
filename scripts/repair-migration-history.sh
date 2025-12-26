#!/usr/bin/env bash

# Helper: Repair Supabase migration history when remote history diverges
# Usage: SUPABASE_ACCESS_TOKEN=... ./scripts/repair-migration-history.sh

set -euo pipefail

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found; make sure you're in the correct dev container"
  exit 2
fi

# Ensure supabase CLI is available via npm
if ! npm exec -- supabase --help >/dev/null 2>&1; then
  echo "Supabase CLI not available via npm. Install 'supabase' with 'npm install -D supabase' or use 'npm login'"
  exit 2
fi

echo "Attempting to pull remote migrations..."
if [ "$#" -gt 0 ] && [ "$1" = "revert" ]; then
  shift
  echo "Building repair command for migrations: $@"
  REPAIR_CMD=(npm exec -- supabase migration repair --status reverted "$@")
  echo "This will run: ${REPAIR_CMD[@]}"
  read -p "Proceed? (y/N) " -r
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm exec -- supabase migration repair --status reverted "$@"
  else
    echo "Aborted by user"
  fi
  exit 0
fi

if ! npm exec -- supabase db pull; then
  echo "\nThere was a problem pulling migrations. The CLI often suggests a 'migration repair' command to mark mismatched migrations as 'applied' or 'reverted'."
  echo "If you trust the remote DB, run the suggested 'supabase migration repair' command printed by the CLI."
  echo "You can optionally pass migration IDs to this script to mark them reverted. Example:"
  echo "  SUPABASE_ACCESS_TOKEN=... ./scripts/repair-migration-history.sh revert 20241122 20241123110000"
  echo "This will build the repair command and ask for confirmation before running it."
  exit 1
fi

echo "Pull complete. You can now review migrations and run 'npm exec -- supabase db push' to apply local changes."