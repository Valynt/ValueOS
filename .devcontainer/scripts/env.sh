#!/usr/bin/env bash
# Deprecated: use env-setup.sh instead.
# Kept for backward compatibility — sources env-setup.sh.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=.devcontainer/scripts/env-setup.sh
source "$SCRIPT_DIR/env-setup.sh"
