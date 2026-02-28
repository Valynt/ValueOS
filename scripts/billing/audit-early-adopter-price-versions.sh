#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SQL_FILE="$PROJECT_ROOT/infra/supabase/audits/early_adopter_subscription_price_version_audit.sql"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[audit-early-adopter-price-versions] DATABASE_URL is required." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[audit-early-adopter-price-versions] psql is required but not found in PATH." >&2
  exit 1
fi

echo "[audit-early-adopter-price-versions] Running early-adopter price_version_id audit..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -f "$SQL_FILE"
echo "[audit-early-adopter-price-versions] Audit completed successfully."
