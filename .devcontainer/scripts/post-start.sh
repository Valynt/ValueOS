#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ ! -d "${ROOT_DIR}" ]]; then
  echo "Repo root not found at ${ROOT_DIR}." >&2
  exit 1
fi

echo "Devcontainer post-start: container is ready."

# Install Docker CLI if not present
if ! command -v docker &> /dev/null; then
  echo "Installing Docker CLI..."
  apk add --no-cache docker-cli
fi

# Start the devcontainer services (excluding the app service which is already running)
echo "Starting devcontainer services..."
cd "${ROOT_DIR}/.devcontainer"

# Start all services except 'app'
docker compose up -d $(docker compose config --services | grep -v '^app$')

echo "Devcontainer services started."
echo "Tip: run scripts/dev/setup.sh if dependencies need refresh."
