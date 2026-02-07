#!/usr/bin/env bash
set -euo pipefail

echo "Waiting for installer to finish..."
docker compose -f .devcontainer/docker-compose.devcontainer.yml -f .devcontainer/docker-compose.subagents.yml wait subagent-installer || true

echo "Installer finished (or wait timed out)."
