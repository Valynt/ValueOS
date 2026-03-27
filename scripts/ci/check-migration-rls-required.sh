#!/usr/bin/env bash
# Fail if any migration file introduces a CREATE TABLE in the public schema
# without a corresponding ENABLE ROW LEVEL SECURITY in the same file or any
# later migration file.
#
# This is a static analysis gate — it does not require a running database.
# It prevents new tables from shipping without RLS as a permanent control.
#
# Scope:
#   PR mode:   only checks migration files changed vs the base branch.
#   Main/local: checks all active migration files (non-rollback, non-archive).
#
# Exit codes:
#   0 — all new tables have RLS enabled somewhere in the migration chain
#   1 — one or more tables are missing ENABLE ROW LEVEL SECURITY
set -euo pipefail

MIGRATION_DIR="infra/supabase/supabase/migrations"

# ── Collect files to check ────────────────────────────────────────────────────

if [ -n "${GITHUB_EVENT_NAME:-}" ] && [ "${GITHUB_EVENT_NAME}" = "pull_request" ]; then
  BASE_REF="${GITHUB_BASE_REF:-main}"
  git fetch origin "$BASE_REF" --depth=1 2>/dev/null || true
  mapfile -t CHANGED_FILES < <(
    git diff --name-only "origin/$BASE_REF...HEAD" -- "${MIGRATION_DIR}" 2>/dev/null \
    | grep '\.sql$' \
    | grep -v '\.rollback\.sql$' \
    | grep -v '/archive/' \
    || true
  )
  CHECK_FILES=("${CHANGED_FILES[@]}")
else
  mapfile -t CHECK_FILES < <(
    find "$MIGRATION_DIR" -maxdepth 1 -name "*.sql" \
    | grep -v '\.rollback\.sql$' \
    | sort
  )
fi

if [ "${#CHECK_FILES[@]}" -eq 0 ]; then
  echo "OK No migration files to check"
  exit 0
fi

# ── Build the full set of tables that have RLS enabled anywhere in the chain ──
# We scan ALL active migrations (not just the changed ones) so that a table
# created in a previous migration and enabled in a later one is not flagged.

mapfile -t ALL_MIGRATIONS < <(
  find "$MIGRATION_DIR" -maxdepth 1 -name "*.sql" \
  | grep -v '\.rollback\.sql$' \
  | sort
)

declare -A RLS_ENABLED_TABLES

for mfile in "${ALL_MIGRATIONS[@]}"; do
  [ -f "$mfile" ] || continue
  while IFS= read -r line; do
    # Match: ALTER TABLE [IF EXISTS] public.<name> ENABLE ROW LEVEL SECURITY
    if [[ "$line" =~ ALTER[[:space:]]+TABLE([[:space:]]+IF[[:space:]]+EXISTS)?[[:space:]]+public\.([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]+ENABLE[[:space:]]+ROW[[:space:]]+LEVEL[[:space:]]+SECURITY ]]; then
      table="${BASH_REMATCH[2]}"
      RLS_ENABLED_TABLES["$table"]=1
    fi
  done < "$mfile"
done

# ── Check each changed/target file for new CREATE TABLE without RLS ───────────

EXIT_CODE=0

for mfile in "${CHECK_FILES[@]}"; do
  [ -z "$mfile" ] && continue
  [ -f "$mfile" ] || continue

  while IFS= read -r line; do
    # Match: CREATE TABLE [IF NOT EXISTS] public.<name>
    if [[ "$line" =~ CREATE[[:space:]]+TABLE([[:space:]]+IF[[:space:]]+NOT[[:space:]]+EXISTS)?[[:space:]]+public\.([a-zA-Z_][a-zA-Z0-9_]*) ]]; then
      table="${BASH_REMATCH[2]}"

      # Skip transient migration intermediaries (renamed away in same migration).
      # Anchor the match so that a table named "foo" is not skipped because of
      # an unrelated "RENAME TO foobar" line.
      if grep -qE "RENAME TO ${table}([[:space:]];|$)" "$mfile" 2>/dev/null; then
        continue
      fi

      if [ -z "${RLS_ENABLED_TABLES[$table]+_}" ]; then
        echo "::error file=${mfile}::Table 'public.${table}' is created without ENABLE ROW LEVEL SECURITY in any migration. Add RLS before merging."
        echo "FAIL ${mfile}: public.${table} missing ENABLE ROW LEVEL SECURITY"
        EXIT_CODE=1
      fi
    fi
  done < "$mfile"
done

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "OK All new public tables in checked migrations have ENABLE ROW LEVEL SECURITY"
fi

exit $EXIT_CODE
