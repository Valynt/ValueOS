#!/bin/bash

set -e

echo "⚠️  scripts/dev/setup.sh is deprecated."
echo "👉 Please use: npm run setup"
echo ""

npm run setup "$@"
