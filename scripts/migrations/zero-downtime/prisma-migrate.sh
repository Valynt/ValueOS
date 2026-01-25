#!/usr/bin/env bash
set -euo pipefail

PHASE=${ZERO_DOWNTIME_PHASE:-expand}
DATABASE_URL=${DATABASE_URL:?DATABASE_URL is required}

if [[ "$PHASE" != "expand" && "$PHASE" != "contract" ]]; then
  echo "ZERO_DOWNTIME_PHASE must be 'expand' or 'contract' (got '$PHASE')." >&2
  exit 1
fi

echo "🚀 Running Prisma zero-downtime migration ($PHASE phase)..."

npx prisma migrate status
npx prisma migrate deploy

if [[ -n "${ZERO_DOWNTIME_BACKFILL_SQL:-}" && "$PHASE" == "expand" ]]; then
  echo "🧩 Running backfill SQL ($ZERO_DOWNTIME_BACKFILL_SQL)"
  npx prisma db execute --file "$ZERO_DOWNTIME_BACKFILL_SQL"
fi

if [[ -n "${ZERO_DOWNTIME_CLEANUP_SQL:-}" && "$PHASE" == "contract" ]]; then
  echo "🧹 Running cleanup SQL ($ZERO_DOWNTIME_CLEANUP_SQL)"
  npx prisma db execute --file "$ZERO_DOWNTIME_CLEANUP_SQL"
fi

npx prisma migrate status

echo "✅ Prisma zero-downtime migration complete ($PHASE phase)."
