#!/usr/bin/env bash
set -euo pipefail

# Kill processes listening on common dev ports to avoid dx conflicts.
lsof -tiTCP:3001 -sTCP:LISTEN | xargs -r kill
lsof -tiTCP:5173 -sTCP:LISTEN | xargs -r kill

# Stop any running dx stack.
pnpm run dx:down >/dev/null 2>&1 || true

echo "Ports 3001/5173 cleared and dx stack stopped."
