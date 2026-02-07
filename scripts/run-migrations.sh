#!/bin/bash
set -euo pipefail

echo "🔄 Running canonical migration runner (infra/scripts/apply_migrations.sh)"
exec bash infra/scripts/apply_migrations.sh "$@"
