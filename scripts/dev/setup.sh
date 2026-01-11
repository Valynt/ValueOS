#!/bin/bash

set -euo pipefail

echo "⚠️  scripts/dev/setup.sh is deprecated."
echo "➡️  Use npm run setup (scripts/dx/setup.js) instead."
echo ""

npm run setup -- "$@"
