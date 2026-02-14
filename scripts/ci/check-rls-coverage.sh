#!/usr/bin/env bash
set -euo pipefail

PGHOST=${PGHOST:-localhost}
PGPORT=${PGPORT:-5432}
PGUSER=${PGUSER:-postgres}
PGPASSWORD=${PGPASSWORD:-postgres}
PGDATABASE=${PGDATABASE:-postgres}

export PGPASSWORD

echo "[rls-coverage] Waiting for Postgres at ${PGHOST}:${PGPORT}..."
for i in {1..60}; do
  if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c 'select 1' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "[rls-coverage] Applying authoritative migrations from infra/supabase/supabase/migrations"
DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}" \
  bash scripts/db/apply-migrations.sh

echo "[rls-coverage] Running CI-blocking RLS lint harness"
psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  -f supabase/tests/database/rls_lint.test.sql

echo "[rls-coverage] ✅ RLS coverage checks passed"
