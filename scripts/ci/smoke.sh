#!/usr/bin/env bash
set -e

# Define cleanup function
cleanup() {
  echo "🧹 Cleaning up..."
  ./dev down
}

# Trap exit to cleanup
trap cleanup EXIT

echo "🚀 Bootstrapping environment (Docker mode)..."
./dev up --mode docker

echo "🧪 Running smoke tests..."
if ! ./dev smoke-test --mode docker; then
  echo "❌ Smoke tests failed!"
  echo "🩺 Running doctor diagnostics..."
  ./dev doctor --mode docker
  exit 1
fi

echo "✅ Smoke tests passed!"
