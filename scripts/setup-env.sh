#!/usr/bin/env bash
# setup-env.sh -- Interactive helper to bootstrap a .env file from the right template.
#
# Usage:
#   bash scripts/setup-env.sh [dev|staging|prod|test]
#
# If no argument is given, prompts the user to choose an environment.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_DIR="$ROOT_DIR/ops/env"

choose_env() {
  if [[ -n "${1:-}" ]]; then
    echo "$1"
    return
  fi

  echo ""
  echo "Which environment are you setting up?"
  echo ""
  echo "  1) dev      -- local development (default)"
  echo "  2) staging  -- staging / pre-production"
  echo "  3) prod     -- production"
  echo "  4) test     -- CI / automated tests"
  echo ""
  read -r -p "Enter choice [1-4, default 1]: " choice

  case "${choice:-1}" in
    1|dev)     echo "dev" ;;
    2|staging) echo "staging" ;;
    3|prod)    echo "prod" ;;
    4|test)    echo "test" ;;
    *)         echo "dev" ;;
  esac
}

ENV_NAME="$(choose_env "${1:-}")"

case "$ENV_NAME" in
  dev)
    TEMPLATE="$ENV_DIR/.env.local.example"
    TARGET="$ENV_DIR/.env.local"
    ;;
  staging)
    TEMPLATE="$ENV_DIR/.env.staging.template"
    TARGET="$ENV_DIR/.env.staging"
    ;;
  prod)
    TEMPLATE="$ENV_DIR/.env.production.template"
    TARGET="$ENV_DIR/.env.production"
    ;;
  test)
    TEMPLATE="$ENV_DIR/.env.test.template"
    TARGET="$ENV_DIR/.env.test"
    ;;
  *)
    echo "Unknown environment: $ENV_NAME" >&2
    exit 1
    ;;
esac

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Template not found: $TEMPLATE" >&2
  exit 1
fi

if [[ -f "$TARGET" ]]; then
  echo ""
  echo "Target file already exists: $TARGET"
  read -r -p "Overwrite? [y/N]: " overwrite
  if [[ "${overwrite:-n}" != [yY] ]]; then
    echo "Aborted."
    exit 0
  fi
fi

cp "$TEMPLATE" "$TARGET"
echo ""
echo "Created $TARGET from $TEMPLATE"
echo ""

# Quick validation: check for empty required vars
missing=0
while IFS='=' read -r key value; do
  # Skip comments and blank lines
  [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
  # Strip leading/trailing whitespace
  key="$(echo "$key" | xargs)"
  value="$(echo "$value" | xargs)"

  # Check if value is empty and key looks required (no default, not commented)
  if [[ -z "$value" ]]; then
    case "$key" in
      APP_DOMAIN|SUPABASE_URL|SUPABASE_ANON_KEY|VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY|SECRETS_PROVIDER)
        echo "  [!] $key is empty -- you must fill this in before starting."
        missing=$((missing + 1))
        ;;
    esac
  fi
done < "$TARGET"

if [[ $missing -gt 0 ]]; then
  echo ""
  echo "$missing required variable(s) need values. Edit $TARGET to fill them in."
else
  echo "All critical variables have values. You're ready to go."
fi
