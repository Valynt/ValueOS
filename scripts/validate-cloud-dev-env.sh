#!/usr/bin/env bash
# Validate that all required cloud-dev environment variables are present.
# Loads ops/env/.env.cloud-dev and ops/env/.env.backend.cloud-dev, then
# runs validate_mode_env. Exits non-zero with clear messages on failure.
#
# Usage: bash scripts/validate-cloud-dev-env.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=scripts/lib/require-env.sh
source "$SCRIPT_DIR/lib/require-env.sh"

MODE="cloud-dev"

# Load shared env
shared_file="$PROJECT_ROOT/ops/env/.env.cloud-dev"
if [[ -f "$shared_file" ]]; then
  set -a; source "$shared_file"; set +a
else
  echo "[validate] Missing: $shared_file" >&2
  echo "[validate] Copy from: ops/env/.env.cloud-dev.example" >&2
  exit 1
fi

# Load backend overlay
backend_file="$PROJECT_ROOT/ops/env/.env.backend.cloud-dev"
if [[ -f "$backend_file" ]]; then
  set -a; source "$backend_file"; set +a
else
  echo "[validate] Missing: $backend_file" >&2
  echo "[validate] Copy from: ops/env/.env.backend.cloud-dev.example" >&2
  exit 1
fi

# Run full validation (exits on first missing var with a clear message)
validate_mode_env "$MODE"

echo "[validate] cloud-dev environment OK"
