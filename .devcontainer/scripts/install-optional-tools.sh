#!/usr/bin/env bash
set -euo pipefail

echo "Running optional tools install..."

if command -v python3 >/dev/null 2>&1; then
  python3 -m pip install --upgrade pip || true
fi

# Install optional Python dev tools if present
if [ -f ".devcontainer/requirements.txt" ]; then
  python3 -m pip install -r .devcontainer/requirements.txt || true
fi

# Install recommended global node tools (non-fatal)
if command -v pnpm >/dev/null 2>&1; then
  pnpm install -g eslint prettier eslint-config-prettier || true
fi

echo "Optional tools installation finished."
