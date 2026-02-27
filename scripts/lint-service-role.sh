#!/usr/bin/env bash
# lint-service-role.sh — CI check to prevent ad-hoc createClient(…, SERVICE_ROLE_KEY) usage.
# All service-role Supabase clients must go through the centralized factory in lib/supabase.
#
# Allowlisted paths: test files, config files, the centralized factories themselves.

set -euo pipefail

SEARCH_PATHS=(
  "packages/backend/src"
  "apps/ValyntApp/src"
  "packages/shared/src"
)

EXCLUDE_PATTERNS=(
  "__tests__"
  ".test.ts"
  ".spec.ts"
  "test-fixtures"
  "lib/supabase.ts"
  "lib/supabase.js"
  "config/settings.ts"
  "config/validateEnv.ts"
  "config/startupEnvValidator.ts"
  "config/secretsManager.ts"
  "config/secrets/"
  "config/schema.ts"
  "config/environment.ts"
  "lib/env.ts"
  "security/APIKeyRotationService.ts"
  "benchmarks/"
)

build_exclude_args() {
  local args=""
  for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    args="$args --glob=!**/$pattern"
  done
  echo "$args"
}

EXCLUDE_ARGS=$(build_exclude_args)

violations=0

for dir in "${SEARCH_PATHS[@]}"; do
  if [ ! -d "$dir" ]; then
    continue
  fi

  # shellcheck disable=SC2086
  matches=$(rg --no-heading --line-number \
    "createClient\(.*SERVICE_ROLE" \
    $EXCLUDE_ARGS \
    "$dir" 2>/dev/null || true)

  if [ -n "$matches" ]; then
    echo "ERROR: Direct createClient+SERVICE_ROLE_KEY usage found:"
    echo "$matches"
    violations=$((violations + $(echo "$matches" | wc -l)))
  fi
done

if [ "$violations" -gt 0 ]; then
  echo ""
  echo "Found $violations violation(s)."
  echo "Use the centralized Supabase client factories instead:"
  echo "  Backend:  import { supabase, createServerSupabaseClient } from '../../lib/supabase.js'"
  echo "  Frontend: import { getSupabaseClient } from '../../lib/supabase'"
  exit 1
fi

echo "OK: No direct createClient+SERVICE_ROLE_KEY usage found."
exit 0
