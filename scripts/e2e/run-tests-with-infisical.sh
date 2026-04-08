#!/usr/bin/env bash
# Run Playwright E2E tests with Infisical secrets
# Usage: bash scripts/e2e/run-tests-with-infisical.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENVIRONMENT="${INFISICAL_ENVIRONMENT:-dev}"

CLI_CMD=()
if command -v infisical >/dev/null 2>&1; then
  CLI_CMD=(infisical)
elif command -v pnpm >/dev/null 2>&1; then
  echo "[run-tests-with-infisical] 'infisical' not found; using 'pnpm dlx @infisical/cli'" >&2
  CLI_CMD=(pnpm dlx @infisical/cli)
else
  echo "[run-tests-with-infisical] Neither 'infisical' nor 'pnpm' found" >&2
  exit 1
fi

if [[ ! -f "$PROJECT_ROOT/.infisical.json" ]]; then
  echo "[run-tests-with-infisical] Missing .infisical.json. Run 'infisical init' from the repo root first." >&2
  exit 1
fi

export SECRETS_PROVIDER="infisical"
export APP_ENV="local"
export INFISICAL_ENVIRONMENT="$ENVIRONMENT"

echo "[run-tests-with-infisical] Running Playwright tests with Infisical secrets..."

# Run tests with infisical injecting secrets
cd "$PROJECT_ROOT"
"${CLI_CMD[@]}" run --env="$ENVIRONMENT" -- npx playwright test tests/e2e/high-value-user-experience.spec.ts --project=chromium --workers=1
