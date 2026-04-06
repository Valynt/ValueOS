#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENVIRONMENT="${INFISICAL_ENVIRONMENT:-dev}"

if [[ $# -eq 0 ]]; then
  echo "[run-with-infisical] Usage: bash scripts/dev/run-with-infisical.sh <command> [args...]" >&2
  exit 1
fi

CLI_CMD=()
if command -v infisical >/dev/null 2>&1; then
  CLI_CMD=(infisical)
elif command -v pnpm >/dev/null 2>&1; then
  echo "[run-with-infisical] 'infisical' not found; using 'pnpm dlx @infisical/cli'" >&2
  CLI_CMD=(pnpm dlx @infisical/cli)
elif command -v npx >/dev/null 2>&1; then
  echo "[run-with-infisical] 'infisical' not found; using 'npx -y @infisical/cli'" >&2
  CLI_CMD=(npx -y @infisical/cli)
else
  cat >&2 <<'EOF'
[run-with-infisical] Infisical CLI is not available.
Use one of these non-root options:
  pnpm dlx @infisical/cli login
  npx -y @infisical/cli login
EOF
  exit 1
fi

if [[ ! -f "$PROJECT_ROOT/.infisical.json" ]]; then
  echo "[run-with-infisical] Missing .infisical.json. Run 'infisical init' from the repo root first." >&2
  exit 1
fi

if [[ ! -f "$PROJECT_ROOT/node_modules/.modules.yaml" ]]; then
  echo "[run-with-infisical] Workspace dependencies are missing; running 'pnpm install --frozen-lockfile' first" >&2
  (
    cd "$PROJECT_ROOT"
    pnpm install --frozen-lockfile
  )
fi

cd "$PROJECT_ROOT"
exec "${CLI_CMD[@]}" run --env="$ENVIRONMENT" -- "$@"
