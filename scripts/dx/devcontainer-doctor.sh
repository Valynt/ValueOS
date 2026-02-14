#!/usr/bin/env bash
set -euo pipefail

echo "== Devcontainer Doctor =="

echo "-- User / perms"
id || true
echo

echo "-- Workspace mounts"
pwd || true
ls -la /workspaces 2>/dev/null || true
mount | grep -E "/workspaces" || true
echo

echo "-- node_modules sanity"
if [ -d /workspaces/ValueOS/node_modules ]; then
  echo "node_modules exists:"
  ls -la /workspaces/ValueOS/node_modules | head -50 || true
else
  echo "node_modules missing"
fi
echo

echo "-- Engines"
node -v || true
pnpm -v || true
echo

echo "-- Effective compose services (if docker socket available)"
if command -v docker >/dev/null 2>&1; then
  docker compose --env-file .env.ports -f .devcontainer/docker-compose.devcontainer.yml config --services 2>/dev/null | sort || true
else
  echo "docker not available inside container"
fi
echo

echo "-- DB connectivity (best effort)"
if command -v psql >/dev/null 2>&1; then
  echo "psql present"
else
  echo "psql not present (skip)"
fi
echo

echo "-- Recent setup log"
if [ -f /workspaces/ValueOS/setup.log ]; then
  tail -200 /workspaces/ValueOS/setup.log
else
  echo "setup.log not found"
fi

echo "== End =="
