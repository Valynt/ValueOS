#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
OUT_DIR="${1:-artifacts/perf}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${OUT_DIR}/top-query-fingerprints-${STAMP}.csv"

mkdir -p "${OUT_DIR}"

psql "$DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f infra/observability/sql/top-query-fingerprints.sql \
  --csv \
  > "$OUT_FILE"

echo "Wrote fingerprint extract to ${OUT_FILE}"
