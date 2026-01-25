#!/bin/bash

set -euo pipefail

echo "⚠️  scripts/dev/setup.sh is deprecated."
echo "➡️  Use pnpm run setup (scripts/dx/setup.js) instead."
echo ""

pnpm run setup -- "$@"
