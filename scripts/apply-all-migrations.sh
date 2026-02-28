#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${MIGRATIONS_DIR:=infra/supabase/supabase/migrations}"

echo "DB: ${DATABASE_URL%%\?*}"
echo "Migrations dir: $MIGRATIONS_DIR"

# Optional safety: ensure sslmode is set one way or another
export PGSSLMODE="${PGSSLMODE:-require}"

# Apply in filename order
for f in $(ls -1 "$MIGRATIONS_DIR"/*.sql | sort); do
  echo "Applying: $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "Done."
