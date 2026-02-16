#!/usr/bin/env bash
set -euo pipefail

# Keep post-create intentionally minimal: a single entrypoint controls all setup.
# This prevents setup drift between documentation and devcontainer hooks.

: "${WORKSPACE_FOLDER:?WORKSPACE_FOLDER is not set}"
cd "$WORKSPACE_FOLDER"

exec bash .devcontainer/scripts/bootstrap.sh
