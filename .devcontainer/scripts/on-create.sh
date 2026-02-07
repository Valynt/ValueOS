#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ ! -d "${ROOT_DIR}/.git" ]]; then
  echo "Expected to run inside the ValueOS repo; .git directory missing." >&2
  exit 1
fi

if [[ ! -f "${ROOT_DIR}/package.json" ]]; then
  echo "package.json not found at repo root; devcontainer layout may be incorrect." >&2
  exit 1
fi

echo "Devcontainer on-create: repo structure verified."
