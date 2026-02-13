#!/bin/bash
# healthcheck-services.sh: Wait for backing services (PostgreSQL, Redis, Supabase) to be ready

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

wait_for_service db 5432 "PostgreSQL"
wait_for_service redis 6379 "Redis"
wait_for_service kong 8000 "Supabase API"

echo "All backing services are ready."
