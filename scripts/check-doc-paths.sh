#!/usr/bin/env bash
set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo "ripgrep (rg) is required to run this check." >&2
  exit 1
fi

node scripts/ci/docs-integrity.mjs
