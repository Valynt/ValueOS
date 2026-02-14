#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [[ $# -gt 0 ]]; then
  echo "[DEPRECATED] Ignoring single-file migration argument '$1'; applying canonical ordered migration set." >&2
fi

echo "[DEPRECATED] scripts/supabase/apply-migration.sh delegates to scripts/db/apply-migrations.sh" >&2
exec bash "$PROJECT_ROOT/scripts/db/apply-migrations.sh"
