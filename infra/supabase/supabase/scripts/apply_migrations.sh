#!/bin/bash
set -euo pipefail

# DEPRECATED: Use scripts/db/apply-migrations.sh instead.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

exec "$PROJECT_ROOT/scripts/db/apply-migrations.sh" "$@"
