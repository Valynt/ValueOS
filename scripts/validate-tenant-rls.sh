#!/usr/bin/env bash

# Validate tenant columns and RLS policies using Supabase CLI
# Usage: SUPABASE_ACCESS_TOKEN=... ./scripts/validate-tenant-rls.sh

set -euo pipefail

SQL_FILE=scripts/validate-tenant-rls.sql

if [ ! -f "$SQL_FILE" ]; then
  echo "SQL script not found: $SQL_FILE"
  exit 2
fi

if ! npm exec -- supabase --help >/dev/null 2>&1; then
  echo "Supabase CLI not available via npm. Install 'supabase' to run this test."
  exit 2
fi

echo "Running validation SQL against remote DB (requires SUPABASE_ACCESS_TOKEN)"
npm exec -- supabase db execute --sql "$(cat $SQL_FILE)"