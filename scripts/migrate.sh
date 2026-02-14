#!/usr/bin/env bash
set -euo pipefail

echo "[DEPRECATED] scripts/migrate.sh delegates to scripts/db/apply-migrations.sh" >&2
exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/db/apply-migrations.sh" "$@"
