#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# File lives at infra/supabase/supabase/scripts/apply_migrations.sh
# Repo root is 4 levels up from this script directory.
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

echo "[DEPRECATED] infra/supabase/supabase/scripts/apply_migrations.sh delegates to scripts/db/apply-migrations.sh" >&2
exec bash "$PROJECT_ROOT/scripts/db/apply-migrations.sh" "$@"

