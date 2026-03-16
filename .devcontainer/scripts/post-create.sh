#!/usr/bin/env bash
# Runs after the devcontainer is created (workspace mounted).
# Heavy setup is handled by automations (installDeps, setupTools).
# This script performs lightweight preflight checks only.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=.devcontainer/scripts/env-setup.sh
source "$SCRIPT_DIR/env-setup.sh"

log() { printf '[post-create] %s\n' "$*" >&2; }
die() { printf '[post-create][ERROR] %s\n' "$*" >&2; exit 1; }

WS="${WORKSPACE_FOLDER:-/workspaces/ValueOS}"
[[ -d "$WS" ]] || die "Workspace not found: $WS"
cd "$WS" || die "Failed to cd into workspace: $WS"
[[ -d ".git" ]] || die "Missing .git — expected a mounted repository"

# Make devcontainer scripts executable
find .devcontainer/scripts -type f -name "*.sh" -exec chmod +x {} +

# Ensure pnpm is available (automations will run the full install)
verify_pnpm

log "post-create complete"
