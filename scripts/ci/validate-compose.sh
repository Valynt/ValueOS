#!/bin/bash
set -e

# Validate dev compose
if [ -f infra/docker/docker-compose.dev.yml ]; then
  docker compose -f infra/docker/docker-compose.dev.yml config >/dev/null
  echo "✅ infra/docker/docker-compose.dev.yml is valid."
else
  echo "⚠️ infra/docker/docker-compose.dev.yml not found."
fi

# Validate deps compose
if [ -f docker-compose.deps.yml ]; then
  docker compose -f docker-compose.deps.yml config >/dev/null
  echo "✅ docker-compose.deps.yml is valid."
fi
