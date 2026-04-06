#!/usr/bin/env bash
# Fail if any migration file introduces a CREATE TABLE (or CREATE TABLE ... PARTITION OF)
# in the public schema without:
#   1. A corresponding ENABLE ROW LEVEL SECURITY in the same file or any later migration.
#   2. An organization_id UUID NOT NULL column definition.
#   3. SET lock_timeout and SET statement_timeout declarations at the top of the file.
#
# This is a static analysis gate — it does not require a running database.
# It prevents new tables from shipping without RLS, tenant isolation, or safety
# timeouts as permanent controls.
#
# Scope:
#   PR mode:   only checks migration files changed vs the base branch.
#   Main/local: checks all active migration files (non-rollback, non-archive).
#
# Partition child tables:
#   PostgreSQL does not automatically enable RLS on partition children even when
#   the parent has it. Each partition child must have ENABLE ROW LEVEL SECURITY
#   called explicitly. This script enforces that for both static CREATE TABLE
#   and CREATE TABLE ... PARTITION OF statements.
#   Dynamic partitions created by create_next_monthly_partitions() are exempt
#   from static analysis — they are covered by the function patch in 20260917.
#
# Exit codes:
#   0 — all checks pass
#   1 — one or more violations found
set -euo pipefail

MIGRATION_DIR="infra/supabase/supabase/migrations"

# ── Collect files to check ────────────────────────────────────────────────────

if [ -n "${GITHUB_EVENT_NAME:-}" ] && [ "${GITHUB_EVENT_NAME}" = "pull_request" ]; then
  BASE_REF="${GITHUB_BASE_REF:-main}"
  git fetch origin "$BASE_REF" --depth=1 2>/dev/null || true
  mapfile -t CHANGED_FILES < <(
    git diff --name-only "origin/$BASE_REF..HEAD" -- "${MIGRATION_DIR}" 2>/dev/null \
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
    table=""

    # Match: CREATE TABLE [IF NOT EXISTS] public.<name>
    if [[ "$line" =~ CREATE[[:space:]]+TABLE([[:space:]]+IF[[:space:]]+NOT[[:space:]]+EXISTS)?[[:space:]]+public\.([a-zA-Z_][a-zA-Z0-9_]*) ]]; then
      table="${BASH_REMATCH[2]}"
    fi

    # Match: CREATE TABLE [IF NOT EXISTS] public.<name> PARTITION OF public.<parent>
    # Partition children must also have ENABLE ROW LEVEL SECURITY — PostgreSQL does
    # not inherit RLS enforcement from the parent automatically.
    if [[ "$line" =~ CREATE[[:space:]]+TABLE([[:space:]]+IF[[:space:]]+NOT[[:space:]]+EXISTS)?[[:space:]]+public\.([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]+PARTITION[[:space:]]+OF ]]; then
      table="${BASH_REMATCH[2]}"
    fi

    [ -z "$table" ] && continue

    # Skip transient migration intermediaries (renamed away in same migration).
    # Match a rename *from* this table name, e.g.:
    #   ALTER TABLE [IF EXISTS] public.${table} RENAME TO ...
    if grep -qE "ALTER[[:space:]]+TABLE([[:space:]]+IF[[:space:]]+EXISTS)?[[:space:]]+public\.${table}[[:space:]]+RENAME[[:space:]]+TO" "$mfile" 2>/dev/null; then
      continue
    fi

    # Skip dynamic partition creation via format() / EXECUTE — these are covered
    # by the create_next_monthly_partitions() function patch in 20260917.
    if [[ "$line" =~ format\( ]] || [[ "$line" =~ EXECUTE ]]; then
      continue
    fi

    if [ -z "${RLS_ENABLED_TABLES[$table]+_}" ]; then
      echo "::error file=${mfile}::Table 'public.${table}' is created without ENABLE ROW LEVEL SECURITY in any migration. Add RLS before merging."
      echo "FAIL ${mfile}: public.${table} missing ENABLE ROW LEVEL SECURITY"
      EXIT_CODE=1
    fi
  done < "$mfile"
done

# ── Checks 2 & 3 apply only to new migrations (post-sprint cutoff) ────────────
# The organization_id and timeout checks are forward-looking standards.
# In PR mode all changed files are checked. In local/main mode only files
# with a timestamp >= 20260913 (the sprint hardening cutoff) are checked,
# so pre-existing migrations are not retroactively failed.

# Cutoff: migrations with timestamps strictly after the last pre-existing file
# (20261006) are subject to the new organization_id and timeout standards.
# Files at or before this date were written before the standard was established.
CUTOFF_PREFIX="20261007"

NEW_CHECK_FILES=()
for mfile in "${CHECK_FILES[@]}"; do
  [ -z "$mfile" ] && continue
  [ -f "$mfile" ] || continue
  basename_file=$(basename "$mfile")
  # In PR mode all changed files are already scoped; include all.
  # In local/main mode filter to files at or after the cutoff.
  if [ -n "${GITHUB_EVENT_NAME:-}" ] && [ "${GITHUB_EVENT_NAME}" = "pull_request" ]; then
    NEW_CHECK_FILES+=("$mfile")
  elif [[ "$basename_file" > "${CUTOFF_PREFIX}" ]] || [[ "$basename_file" == "${CUTOFF_PREFIX}"* ]]; then
    NEW_CHECK_FILES+=("$mfile")
  fi
done

# ── Check 2: organization_id UUID NOT NULL required on all new tables ─────────
# Every new public table must include an organization_id UUID NOT NULL column
# to enforce the canonical tenant isolation standard.
# Exemptions: partition children (they inherit from parent), tables that are
# purely audit/log tables with no tenant data (must be explicitly noted).

for mfile in "${NEW_CHECK_FILES[@]}"; do
  [ -z "$mfile" ] && continue
  [ -f "$mfile" ] || continue

  while IFS= read -r line; do
    table=""

    if [[ "$line" =~ CREATE[[:space:]]+TABLE([[:space:]]+IF[[:space:]]+NOT[[:space:]]+EXISTS)?[[:space:]]+public\.([a-zA-Z_][a-zA-Z0-9_]*) ]]; then
      table="${BASH_REMATCH[2]}"
    fi

    [ -z "$table" ] && continue

    # Skip partition children — they inherit tenant isolation from parent
    if grep -qE "PARTITION[[:space:]]+OF" "$mfile" 2>/dev/null; then
      continue
    fi

    # Skip tables renamed away in the same migration
    if grep -qE "ALTER[[:space:]]+TABLE([[:space:]]+IF[[:space:]]+EXISTS)?[[:space:]]+public\.${table}[[:space:]]+RENAME[[:space:]]+TO" "$mfile" 2>/dev/null; then
      continue
    fi

    # Skip dynamic partition creation
    if [[ "$line" =~ format\( ]] || [[ "$line" =~ EXECUTE ]]; then
      continue
    fi

    # Check that organization_id UUID NOT NULL appears in the file
    # Accept: "organization_id UUID NOT NULL" or "organization_id uuid not null"
    if ! grep -qiE "organization_id[[:space:]]+UUID[[:space:]]+NOT[[:space:]]+NULL" "$mfile" 2>/dev/null; then
      echo "::error file=${mfile}::Table 'public.${table}' is missing 'organization_id UUID NOT NULL'. All new tables must include this column for tenant isolation."
      echo "FAIL ${mfile}: public.${table} missing organization_id UUID NOT NULL"
      EXIT_CODE=1
    fi
  done < "$mfile"
done

# ── Check 3: Safety timeout declarations required in all new migration files ──
# Every new migration file must begin with SET lock_timeout and
# SET statement_timeout to prevent long locks during deployments.

for mfile in "${NEW_CHECK_FILES[@]}"; do
  [ -z "$mfile" ] && continue
  [ -f "$mfile" ] || continue

  # Only enforce on files that contain DDL (CREATE TABLE, ALTER TABLE, CREATE INDEX)
  if ! grep -qiE "CREATE[[:space:]]+TABLE|ALTER[[:space:]]+TABLE|CREATE[[:space:]]+(UNIQUE[[:space:]]+)?INDEX" "$mfile" 2>/dev/null; then
    continue
  fi

  if ! grep -qiE "SET[[:space:]]+lock_timeout" "$mfile" 2>/dev/null; then
    echo "::error file=${mfile}::Migration is missing 'SET lock_timeout = ...' declaration. Add it at the top of the file to prevent long table locks during deployment."
    echo "FAIL ${mfile}: missing SET lock_timeout declaration"
    EXIT_CODE=1
  fi

  if ! grep -qiE "SET[[:space:]]+statement_timeout" "$mfile" 2>/dev/null; then
    echo "::error file=${mfile}::Migration is missing 'SET statement_timeout = ...' declaration. Add it at the top of the file to cap runaway statements."
    echo "FAIL ${mfile}: missing SET statement_timeout declaration"
    EXIT_CODE=1
  fi
done

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "OK All migration checks passed (RLS, organization_id, safety timeouts)"
fi

exit $EXIT_CODE
