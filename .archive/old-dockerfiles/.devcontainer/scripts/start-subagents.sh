#!/usr/bin/env bash
set -euo pipefail

echo "Starting DevContainer subagents..."

docker compose -f .devcontainer/docker-compose.devcontainer.yml -f .devcontainer/docker-compose.subagents.yml --profile devcontainer up --build -d subagent-installer subagent-lint subagent-test || true

echo "Subagents started (detached)."
