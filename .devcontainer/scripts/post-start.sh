#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ ! -d "${ROOT_DIR}" ]]; then
  echo "Repo root not found at ${ROOT_DIR}." >&2
  exit 1
fi

echo "Devcontainer post-start: container is ready."
echo "Tip: run scripts/dev/setup.sh if dependencies need refresh."
