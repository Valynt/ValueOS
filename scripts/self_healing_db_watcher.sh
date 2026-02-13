#!/usr/bin/env bash
# scripts/self_healing_db_watcher.sh
# ValueOS Self-Healing Database Watcher
# - Drift detection & auto-fix
# - Connection pool health & zombie cleanup
# - Secret rotation safety check

set -euo pipefail

# CONFIG
DB_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
PRISMA_SCHEMA="./packages/backend/prisma/schema.prisma"
SQL_MANIFEST="./supabase/schema.sql"

log() {
  echo "[Self-Healing DB Watcher] $1"
}

# 1. Drift Detection & Auto-Fix
log "Checking for schema drift..."
if command -v prisma &>/dev/null; then
  prisma migrate diff \
    --from-url "$DB_URL" \
    --to-schema-datamodel "$PRISMA_SCHEMA" \
    --script > /tmp/prisma-drift.sql || true
  if grep -qE "ALTER|CREATE|DROP" /tmp/prisma-drift.sql; then
    log "Drift detected. Attempting auto-fix (structural only)..."
    # Only apply if no destructive ops
    if ! grep -qE "DROP TABLE|DROP COLUMN" /tmp/prisma-drift.sql; then
      psql "$DB_URL" -f /tmp/prisma-drift.sql && log "Drift auto-fixed."
    else
      log "Destructive drift detected. Manual review required."
    fi
  else
    log "No schema drift detected."
  fi
else
  log "Prisma CLI not found. Skipping drift check."
fi

# 2. Connection Pool Health & Zombie Cleanup
log "Checking DB connection pool health..."
ZOMBIES=$(psql "$DB_URL" -Atc "SELECT pid FROM pg_stat_activity WHERE state = 'idle' AND now() - state_change > interval '10 minutes';")
if [[ -n "$ZOMBIES" ]]; then
  log "Found zombie connections: $ZOMBIES. Terminating..."
  for pid in $ZOMBIES; do
    psql "$DB_URL" -c "SELECT pg_terminate_backend($pid);"
  done
  log "Zombie connections cleared."
else
  log "No zombie connections detected."
fi

# 3. Secret Rotation Safety Check
log "Checking for active agent tasks before DB credential rotation..."
ACTIVE_TASKS=$(psql "$DB_URL" -Atc "SELECT count(*) FROM agent_tasks WHERE status = 'running';" || echo "0")
if [[ "$ACTIVE_TASKS" -gt 0 ]]; then
  log "Active agent tasks detected ($ACTIVE_TASKS). Deferring credential rotation."
else
  log "No active agent tasks. Safe to rotate DB credentials."
fi

log "Self-Healing DB Watcher completed."
