#!/usr/bin/env bash
# reset-dev-env.sh: Deterministically reset ValueOS dev environment (host-side only)
# Usage: ./reset-dev-env.sh
set -euo pipefail

# 1. Remove VS Code Dev Containers cache (safe, not required for Codespaces)
rm -rf ~/.vscode-server/data/User/globalStorage/ms-vscode-remote.remote-containers || true
rm -rf ~/.vscode-server/extensions/ms-vscode-remote.remote-containers* || true

# 2. Remove Compose override at root (if present, will be re-copied by devcontainer.json)
rm -f ./compose.devcontainer.override.yml || true

# 3. Hard reset Docker state
cd "$(dirname "$0")"
docker compose down -v || true
docker volume prune -f || true

# 4. Sanity check Compose config
cp .devcontainer/compose.devcontainer.override.yml ./compose.devcontainer.override.yml

docker compose -f docker-compose.yml -f compose.devcontainer.override.yml config --services

# 5. Remove host node_modules (guard)
rm -rf ./node_modules
rm -rf ./apps/ValyntApp/node_modules

# 6. Success message
echo "✅ Dev environment reset. Ready for: Dev Containers: Rebuild Container"
