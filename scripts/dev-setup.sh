#!/bin/bash

set -e

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

echo "⚠️  scripts/dev-setup.sh is deprecated."
echo "   Use: bash scripts/dev/setup.sh (or npm run setup)"
echo ""

exec bash "${SCRIPT_DIR}/dev/setup.sh"
