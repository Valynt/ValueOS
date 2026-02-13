#!/bin/bash
set -euo pipefail

BASE=ops/compose/compose.yml
DEV=ops/compose/devcontainer.yml
SUPABASE=ops/compose/profiles/supabase.yml
OBS=ops/compose/profiles/observability.yml

for forbidden in compose.yml docker-compose.yml docker-compose.yaml; do
  if [ -f "$forbidden" ]; then
    echo "❌ Forbidden root compose file detected: $forbidden"
    echo "Compose lives in ops/compose/."
    exit 1
  fi
done

docker compose -f "$BASE" -f "$DEV" config >/dev/null
echo "✅ Canonical base + devcontainer compose is valid."

docker compose -f "$BASE" -f "$SUPABASE" config >/dev/null
echo "✅ Canonical base + supabase profile compose is valid."

docker compose -f "$BASE" -f "$OBS" config >/dev/null
echo "✅ Canonical base + observability profile compose is valid."
