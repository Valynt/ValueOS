#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== ValueOS Devcontainer Quick Setup ==="

echo "1) Installing Node dependencies..."
pnpm install

echo "2) Ensuring environment is configured (runs 'pnpm run env:dev')..."
if pnpm run env:dev; then
  echo "env:dev completed"
else
  echo "env:dev exited with non-zero status — check environment files" >&2
fi

echo "3) Starting development stack via ./scripts/dc..."
echo "This will start local services from compose.yml with the default profile."
"${ROOT_DIR}/scripts/dc" up -d
"${ROOT_DIR}/scripts/dc" ps

echo
echo "DEV stack started. Wait a moment for services to become healthy."

read -r -p "Do you want to run the destructive DB reset and seed demo data now? [y/N] " RESP
case "$RESP" in
  [yY][eE][sS]|[yY])
    echo "Running db:reset and seed:demo (DESTRUCTIVE)..."
    pnpm run db:reset
    pnpm run seed:demo
    echo "Demo data seeded."
    ;;
  *)
    echo "Skipping DB reset/seed. You can run 'pnpm run db:reset && pnpm run seed:demo' later."
    ;;
esac

echo "All done — open http://localhost:5173 in the browser (or use Codespaces preview)."
