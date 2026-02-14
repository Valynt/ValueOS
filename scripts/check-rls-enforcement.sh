#!/bin/bash
# scripts/check-rls-enforcement.sh
# Fails if any table lacks RLS or if a policy allows NULL org/tenant access without justification

set -e

MIGRATIONS_DIR="infra/supabase/supabase/migrations"

# Check for RLS enforcement
missing_rls=$(grep -L 'ENABLE ROW LEVEL SECURITY' $MIGRATIONS_DIR/*.sql || true)
if [[ -n "$missing_rls" ]]; then
  echo "ERROR: The following migration files do not enable RLS on all tables:"
  echo "$missing_rls"
  exit 1
fi

# Check for policies that allow NULL org/tenant access without comment
bad_policies=$(grep -E 'USING \(.*(organization_id|tenant_id) IS NULL' $MIGRATIONS_DIR/*.sql | grep -vE '^--' || true)
if [[ -n "$bad_policies" ]]; then
  echo "ERROR: The following policies allow NULL org/tenant access without justification:"
  echo "$bad_policies"
  exit 1
fi

echo "RLS enforcement and NULL org/tenant policy checks passed."
