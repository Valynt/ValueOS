#!/usr/bin/env bash
set -euo pipefail

PGHOST=${PGHOST:-localhost}
PGPORT=${PGPORT:-5432}
PGUSER=${PGUSER:-postgres}
PGPASSWORD=${PGPASSWORD:-postgres}
PGDATABASE=${PGDATABASE:-postgres}

export PGPASSWORD

echo "[migrations-ephemeral] Waiting for Postgres at $PGHOST:$PGPORT..."
for i in {1..30}; do
  if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c '\q' >/dev/null 2>&1; then
    echo "[migrations-ephemeral] Postgres is available"
    break
  fi
  sleep 1
done

echo "[migrations-ephemeral] Applying migrations from supabase/migrations"
shopt -s nullglob
MIGS=(supabase/migrations/*.sql)
if [ ${#MIGS[@]} -eq 0 ]; then
  echo "[migrations-ephemeral] No migrations found in supabase/migrations"
else
  for f in "${MIGS[@]}"; do
    echo "[migrations-ephemeral] Applying: $f"
    psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$f"
  done
fi

echo "[migrations-ephemeral] Running rollbacks from supabase/rollbacks in reverse order"
ROLLS=(supabase/rollbacks/*.sql)
if [ ${#ROLLS[@]} -eq 0 ]; then
  echo "[migrations-ephemeral] No rollback files found in supabase/rollbacks"
else
  # reverse sort by name to attempt to undo in reverse order
  for f in $(printf "%s\n" "${ROLLS[@]}" | sort -r); do
    echo "[migrations-ephemeral] Rolling back: $f"
    psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$f"
  done
fi

echo "[migrations-ephemeral] Completed apply+rollback run"

#!/usr/bin/env bash
set -euo pipefail

PGHOST=${PGHOST:-localhost}
PGPORT=${PGPORT:-5432}
PGUSER=${PGUSER:-postgres}
PGPASSWORD=${PGPASSWORD:-postgres}
PGDATABASE=${PGDATABASE:-postgres}

export PGPASSWORD

echo "[migrations-ephemeral] Waiting for Postgres at $PGHOST:$PGPORT..."
for i in {1..30}; do
  if psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -c '\q' >/dev/null 2>&1; then
    echo "[migrations-ephemeral] Postgres is available"
    break
  fi
  sleep 1
done

echo "[migrations-ephemeral] Applying migrations from supabase/migrations"
shopt -s nullglob
MIGS=(supabase/migrations/*.sql)
if [ ${#MIGS[@]} -eq 0 ]; then
  echo "[migrations-ephemeral] No migrations found in supabase/migrations"
else
  for f in "${MIGS[@]}"; do
    echo "[migrations-ephemeral] Applying: $f"
    psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$f"
  done
fi

echo "[migrations-ephemeral] Running rollbacks from supabase/rollbacks in reverse order"
ROLLS=(supabase/rollbacks/*.sql)
if [ ${#ROLLS[@]} -eq 0 ]; then
  echo "[migrations-ephemeral] No rollback files found in supabase/rollbacks"
else
  # reverse sort by name to attempt to undo in reverse order
  for f in $(printf "%s\n" "${ROLLS[@]}" | sort -r); do
    echo "[migrations-ephemeral] Rolling back: $f"
    psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$f"
  done
fi

echo "[migrations-ephemeral] Completed apply+rollback run"
