#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

SETUP_SCRIPT="${ROOT_DIR}/scripts/dev/setup.sh"

if [[ ! -f "${SETUP_SCRIPT}" ]]; then
  echo "Expected setup script at ${SETUP_SCRIPT} but it was not found." >&2
  exit 1
fi

echo "Devcontainer update-content: syncing dependencies via ${SETUP_SCRIPT}."

bash "${SETUP_SCRIPT}"
