#!/usr/bin/env bash
set -euo pipefail

log()  { printf '[on-create] %s\n' "$*" >&2; }
warn() { printf '[on-create][WARN] %s\n' "$*" >&2; }

# Minimal, safe container-level init + mount diagnostics.
# IMPORTANT: do NOT rely on workspace mounts or workspace files here —
# that logic belongs in post-create (runs after workspace is mounted).

WS="${WORKSPACE_FOLDER:-/workspaces/ValueOS}"

log "WORKSPACE_FOLDER=${WS}"

# Minimal mount diagnostics (safe)
if [ -d /workspaces ]; then
  log "/workspaces exists"
else
  warn "/workspaces does NOT exist (workspace mount may not be ready yet)"
fi

if [ -d "${WS}" ]; then
  log "Workspace dir exists: ${WS}"
else
  warn "Workspace dir missing: ${WS}"
fi

if [ -d "${WS}/.devcontainer/scripts" ]; then
  log ".devcontainer/scripts visible under workspace (listing):"
  ls -la "${WS}/.devcontainer/scripts" || true
else
  warn ".devcontainer/scripts not present under workspace"
fi

# Print mount status (best-effort)
mount | grep -E "/workspaces" || true

# Container-internal setup (safe to run before mount)
log "Running container-level package/tool bootstrap (non-fatal)"

# Ensure build-essential available for native builds
if ! dpkg -s build-essential >/dev/null 2>&1; then
  log "Installing build-essential..."
  sudo apt-get update -qq && sudo apt-get install -y --no-install-recommends build-essential || warn "apt-get install failed"
else
  log "build-essential already present"
fi

# Enable corepack (safe, minimal)
if command -v corepack >/dev/null 2>&1; then
  corepack enable || warn "corepack enable failed"
else
  warn "corepack not available in image"
fi

# Marker so other scripts can detect onCreate ran
mkdir -p /home/vscode/.devcontainer
touch /home/vscode/.devcontainer/.onCreateCommandMarker

log "on-create (container-level) completed — heavy repo setup moved to post-create.sh"
