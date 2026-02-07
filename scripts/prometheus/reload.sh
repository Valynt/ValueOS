#!/usr/bin/env bash
set -euo pipefail

PROM_URL=${PROMETHEUS_RELOAD_URL:-}
TOKEN=${PROMETHEUS_BEARER_TOKEN:-}

if [[ -z "$PROM_URL" ]]; then
  echo "❌ PROMETHEUS_RELOAD_URL not set. Export it or pass PROMETHEUS_RELOAD_URL env var."
  exit 1
fi

echo "Calling Prometheus reload endpoint: $PROM_URL"

if [[ -n "$TOKEN" ]]; then
  curl -sSf -H "Authorization: Bearer $TOKEN" -X POST "$PROM_URL" && echo "\n✅ Reload requested"
else
  curl -sSf -X POST "$PROM_URL" && echo "\n✅ Reload requested"
fi
