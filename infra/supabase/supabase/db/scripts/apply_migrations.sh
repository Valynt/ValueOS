#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"

echo "[DEPRECATED] infra/supabase/supabase/db/scripts/apply_migrations.sh delegates to scripts/db/apply-migrations.sh" >&2
exec bash "$PROJECT_ROOT/scripts/db/apply-migrations.sh" "$@"
