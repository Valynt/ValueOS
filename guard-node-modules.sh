#!/usr/bin/env bash
# guard-node-modules.sh: Prevent host node_modules pollution in ValueOS
# Usage: source this in your shell or call from prestart scripts

if [ -d "./node_modules" ] || [ -d "./apps/ValyntApp/node_modules" ]; then
  echo "❌ ERROR: Host node_modules detected. Please run ./reset-dev-env.sh and use Docker volumes only."
  exit 1
fi
