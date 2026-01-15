#!/usr/bin/env bash
set -euo pipefail

# ValueOS Failsafe Verification Wrapper
# Runs verification in Docker container and extracts results
# No volume mounts needed - works in restricted workspaces

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Building verification image..."
docker build -f Dockerfile.verify -t valueos-verify:node18 "$SCRIPT_DIR" >/dev/null 2>&1

echo "Running verification..."
cid=$(docker create valueos-verify:node18)
docker start -a "$cid" >/dev/null 2>&1

echo "Extracting results..."
docker cp "$cid":/work/verify.result.json "$SCRIPT_DIR/verify.result.json" >/dev/null 2>&1
docker rm "$cid" >/dev/null 2>&1

echo "Results:"
cat "$SCRIPT_DIR/verify.result.json"
