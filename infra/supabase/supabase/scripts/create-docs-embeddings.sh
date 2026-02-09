#!/usr/bin/env bash
set -euo pipefail

# Convenience helper: apply the docs_embeddings migration
# Usage: infra/scripts/create-docs-embeddings.sh [--apply]

MIGRATION_FILE="infra/supabase/migrations/20260207_create_docs_embeddings.sql"

if [ "$1" = "--apply" ]; then
  if command -v supabase >/dev/null 2>&1; then
    echo "Applying migration via supabase CLI"
    supabase db query < "$MIGRATION_FILE"
  else
    echo "supabase CLI not found. To apply migration locally, you can run psql against your database:" >&2
    echo "  psql \"$SUPABASE_DB_CONN\" -f $MIGRATION_FILE" >&2
    exit 1
  fi
else
  echo "Migration file located at: $MIGRATION_FILE"
  echo "To apply: infra/scripts/create-docs-embeddings.sh --apply (supabase CLI required)"
fi
