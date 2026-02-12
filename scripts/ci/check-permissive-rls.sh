#!/usr/bin/env bash
# Fail if any NEW migration file creates a permissive RLS policy granting
# unrestricted access to the 'authenticated' role.
#
# Catches patterns like:
#   CREATE POLICY ... TO authenticated USING (true)
#   CREATE POLICY ... TO authenticated ... WITH CHECK (true)
#
# Allowed:
#   TO service_role USING (true)  — service_role bypasses RLS anyway
#   TO authenticated USING (security.is_current_user_tenant_member(...))
#
# Scope: In PRs, only checks files changed vs base branch.
# On push to main or local runs, checks all active migration files.
# The hardening migration (20260212000006) drops legacy permissive policies
# from the base schema, so we don't flag historical migrations that are
# already remediated.
set -euo pipefail

MIGRATION_DIR="infra/supabase/supabase/migrations"

# Determine which files to check
if [ -n "${GITHUB_EVENT_NAME:-}" ] && [ "${GITHUB_EVENT_NAME}" = "pull_request" ]; then
  # PR: only check changed migration files
  BASE_REF="${GITHUB_BASE_REF:-main}"
  git fetch origin "$BASE_REF" --depth=1 2>/dev/null || true
  mapfile -t FILES < <(git diff --name-only "origin/$BASE_REF...HEAD" -- "$MIGRATION_DIR/*.sql" 2>/dev/null || true)
else
  # Push to main or local run: check all active migration files
  mapfile -t FILES < <(find "$MIGRATION_DIR" -maxdepth 1 -name "*.sql" | sort)
fi

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "No migration files to check"
  exit 0
fi

EXIT_CODE=0

for file in "${FILES[@]}"; do
  [ -z "$file" ] && continue
  [ ! -f "$file" ] && continue

  # Extract CREATE POLICY blocks and check for the dangerous pattern:
  # TO authenticated ... USING (true) or WITH CHECK (true)
  violations=$(awk '
    /CREATE POLICY/{block=$0; collecting=1; next}
    collecting{block=block" "$0}
    collecting && /;/{
      gsub(/[[:space:]]+/, " ", block)
      if (block ~ /TO authenticated/ && (block ~ /USING \(true\)/ || block ~ /WITH CHECK \(true\)/)) {
        print block
      }
      block=""
      collecting=0
    }
  ' "$file")

  if [ -n "$violations" ]; then
    echo "::error file=${file}::Permissive RLS policy targeting authenticated role with USING (true) or WITH CHECK (true)"
    echo "FAIL $file"
    echo "$violations" | while IFS= read -r line; do
      echo "   $line"
    done
    echo ""
    EXIT_CODE=1
  fi
done

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "OK No permissive authenticated USING (true) policies found in checked migrations"
fi

exit $EXIT_CODE
