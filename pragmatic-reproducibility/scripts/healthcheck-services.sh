#!/bin/bash
# healthcheck-services.sh: Wait for backing services (PostgreSQL, Redis, Supabase/Kong) to be ready

set -euo pipefail

function wait_for_service() {
  local host="$1"
  local port="$2"
  local name="$3"
  echo "Waiting for $name ($host:$port)..."
  for i in {1..30}; do
    if nc -z "$host" "$port"; then
      echo "$name is ready."
      return 0
    fi
    sleep 2
  done
  echo "Timeout waiting for $name ($host:$port)" >&2
  return 1
}

POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-54323}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
KONG_HOST="${KONG_HOST:-localhost}"
KONG_PORT="${KONG_PORT:-8000}"

wait_for_service "$POSTGRES_HOST" "$POSTGRES_PORT" "PostgreSQL"
wait_for_service "$REDIS_HOST" "$REDIS_PORT" "Redis"
wait_for_service "$KONG_HOST" "$KONG_PORT" "Supabase API"

echo "All backing services are ready."
