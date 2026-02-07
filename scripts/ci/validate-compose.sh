#!/bin/bash
set -e

compose_files=(
  "ops/compose/dev.yml"
  "ops/compose/core.yml"
  "ops/compose/observability.yml"
  "ops/compose/tools.yml"
)

for file in "${compose_files[@]}"; do
  if [ -f "$file" ]; then
    docker compose --project-directory . -f "$file" config >/dev/null
    echo "✅ $file is valid."
  else
    echo "⚠️ $file not found."
  fi
done
