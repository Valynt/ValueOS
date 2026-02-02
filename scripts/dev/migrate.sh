#!/bin/bash
###############################################################################
# Idempotent Database Migration Script
#
# Applies ValueOS Postgres migrations (psql-first).
#
# Usage: bash scripts/dev/migrate.sh [--dry-run] [--extreme-force] [--prompt-destructive]
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Backwards-compatible arg filtering: this script historically accepted --debug/--psql-only.
FORWARD_ARGS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run|--extreme-force|--prompt-destructive|--help|-h)
            FORWARD_ARGS+=("$1")
            shift
            ;;
        --debug|--psql-only)
            shift
            ;;
        *)
            # Ignore unknown flags for compatibility.
            shift
            ;;
    esac
done

exec bash "$PROJECT_ROOT/infra/scripts/apply_migrations.sh" "${FORWARD_ARGS[@]}"
