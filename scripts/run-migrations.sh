#!/usr/bin/env bash
set -euo pipefail

echo "🔄 Running canonical migration runner (scripts/db/apply-migrations.sh)"
exec bash scripts/db/apply-migrations.sh "$@"
