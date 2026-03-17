#!/usr/bin/env bash
# Runs every time the devcontainer starts.
# Service health checks are handled by automations service ready commands.
# This script is a no-op placeholder kept for devcontainer lifecycle compatibility.
set -euo pipefail

log() { printf '[post-start] %s\n' "$*" >&2; }

WS="${WORKSPACE_FOLDER:-/workspaces/ValueOS}"
[[ -d "$WS" ]] && cd "$WS" || true

log "Environment: APP_ENV=${APP_ENV:-unset}"
log "post-start complete"
