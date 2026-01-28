#!/usr/bin/env bash
set -euo pipefail

MIGRATION_FILE=${1:-infra/supabase/migrations/20260128120000_add_idx_opportunities_value_case_tenant.sql}

echo "🔁 Applying migration: $MIGRATION_FILE"

if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo "❌ Migration file not found: $MIGRATION_FILE"
  exit 1
fi

# Auto-detect project ref from VITE_SUPABASE_URL if not provided
if [[ -z "${SUPABASE_PROJECT_ID:-}${SUPABASE_PROJECT_REF:-}" && -n "${VITE_SUPABASE_URL:-}" ]]; then
  host=$(echo "$VITE_SUPABASE_URL" | sed -E 's#https?://##' | sed -E 's#/.*##')
  if [[ "$host" =~ ^([a-z0-9-]+)\.supabase\.co$ ]]; then
    SUPABASE_PROJECT_REF="${BASH_REMATCH[1]}"
    echo "Detected SUPABASE_PROJECT_REF=$SUPABASE_PROJECT_REF from VITE_SUPABASE_URL"
  fi
fi

# Prefer SUPABASE_DATABASE_URL (psql) when available
if [[ -n "${SUPABASE_DATABASE_URL:-}" ]]; then
  if command -v psql >/dev/null 2>&1; then
    echo "Using psql with SUPABASE_DATABASE_URL"
    psql "$SUPABASE_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_FILE"
    echo "✅ Migration applied via psql"
    exit 0
  else
    echo "psql not found in PATH. Will try Supabase CLI via pnpm/npx."
  fi
fi

# Helper to run supabase CLI via available runner
run_supabase() {
  if command -v supabase >/dev/null 2>&1; then
    supabase "$@"
    return $?
  fi
  if command -v pnpm >/dev/null 2>&1; then
    pnpm exec -- supabase "$@"
    return $?
  fi
  if command -v npx >/dev/null 2>&1; then
    npx supabase "$@"
    return $?
  fi
  return 127
}

# Use Supabase CLI if possible
if run_supabase --version >/dev/null 2>&1; then
  if [[ -n "${SUPABASE_PROJECT_ID:-}${SUPABASE_PROJECT_REF:-}" ]]; then
    echo "Using Supabase CLI to push migrations (workdir infra/supabase) with project ref ${SUPABASE_PROJECT_ID:-${SUPABASE_PROJECT_REF:-}}"
    # Try linking the project in the infra/supabase workdir then push
    if [[ -n "${SUPABASE_PROJECT_ID:-}${SUPABASE_PROJECT_REF:-}" ]]; then
      echo "Linking project in infra/supabase"
      run_supabase link --workdir infra/supabase --project-ref "${SUPABASE_PROJECT_ID:-${SUPABASE_PROJECT_REF:-}}" || true
    fi
    run_supabase db push --workdir infra/supabase
    echo "✅ Migration applied via supabase CLI"
    exit 0
  else
    echo "Supabase CLI available but no project ref set (SUPABASE_PROJECT_ID or SUPABASE_PROJECT_REF)."
  fi
else
  echo "Supabase CLI not available via global/pnpm/npx."
fi

echo "Unable to apply migration: no usable DB client found.
Options:
  - Export SUPABASE_DATABASE_URL and install psql, or
  - Install Supabase CLI (local dev: pnpm add -D supabase) and set SUPABASE_PROJECT_ID / SUPABASE_PROJECT_REF, or
  - Set VITE_SUPABASE_URL to detect project ref and install Supabase CLI, then run this script again."
exit 2
