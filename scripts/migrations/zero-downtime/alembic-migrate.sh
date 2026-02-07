#!/usr/bin/env bash
set -euo pipefail

PHASE=${ZERO_DOWNTIME_PHASE:-expand}
ALEMBIC_CONFIG=${ALEMBIC_CONFIG:-alembic.ini}
ALEMBIC_REVISION=${ALEMBIC_REVISION:-head}

if [[ "$PHASE" != "expand" && "$PHASE" != "contract" ]]; then
  echo "ZERO_DOWNTIME_PHASE must be 'expand' or 'contract' (got '$PHASE')." >&2
  exit 1
fi

if [[ ! -f "$ALEMBIC_CONFIG" ]]; then
  echo "Alembic config not found at $ALEMBIC_CONFIG" >&2
  exit 1
fi

echo "🚀 Running Alembic zero-downtime migration ($PHASE phase)..."

alembic -c "$ALEMBIC_CONFIG" current
alembic -c "$ALEMBIC_CONFIG" upgrade "$ALEMBIC_REVISION"

if [[ -n "${ZERO_DOWNTIME_BACKFILL_SQL:-}" && "$PHASE" == "expand" ]]; then
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "DATABASE_URL is required to run backfill SQL." >&2
    exit 1
  fi
  echo "🧩 Running backfill SQL ($ZERO_DOWNTIME_BACKFILL_SQL)"
  psql "$DATABASE_URL" -f "$ZERO_DOWNTIME_BACKFILL_SQL"
fi

if [[ -n "${ZERO_DOWNTIME_CLEANUP_SQL:-}" && "$PHASE" == "contract" ]]; then
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "DATABASE_URL is required to run cleanup SQL." >&2
    exit 1
  fi
  echo "🧹 Running cleanup SQL ($ZERO_DOWNTIME_CLEANUP_SQL)"
  psql "$DATABASE_URL" -f "$ZERO_DOWNTIME_CLEANUP_SQL"
fi

alembic -c "$ALEMBIC_CONFIG" current

echo "✅ Alembic zero-downtime migration complete ($PHASE phase)."
