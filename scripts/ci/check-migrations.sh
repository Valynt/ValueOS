#!/usr/bin/env bash
set -euo pipefail
BASE_BRANCH=${BASE_BRANCH:-main}
ERRORS=0

echo "[migrations-check] Base branch: $BASE_BRANCH"

git fetch origin "$BASE_BRANCH" --depth=1 >/dev/null 2>&1 || true
DIFF_OUTPUT=$(git diff --name-status "origin/$BASE_BRANCH...HEAD" || git diff --name-status "$BASE_BRANCH...HEAD")

if [ -z "$DIFF_OUTPUT" ]; then
  echo "[migrations-check] No changes detected vs $BASE_BRANCH. Exiting OK."
  exit 0
fi

echo "[migrations-check] Changed files:
$DIFF_OUTPUT"

ADDED_MIGRATIONS=()

while IFS=$'\t' read -r status path; do
  path=${path//\"/}
  if [[ $path == supabase/migrations/* ]]; then
    if [[ $status != A ]]; then
      echo "[migrations-check][ERROR] Existing migration modified: $path — migrations must be append-only."
      ERRORS=$((ERRORS+1))
    else
      ADDED_MIGRATIONS+=("$path")
    fi
  fi
done < <(echo "$DIFF_OUTPUT")

if [ ${#ADDED_MIGRATIONS[@]} -eq 0 ]; then
  if [ $ERRORS -gt 0 ]; then
    echo "[migrations-check] FAILED: $ERRORS error(s)."
    exit 1
  fi
  echo "[migrations-check] No new migrations added. Append-only checks passed."
  exit 0
fi

echo "[migrations-check] New migrations detected:"
for m in "${ADDED_MIGRATIONS[@]}"; do
  echo "  - $m"
done

for m in "${ADDED_MIGRATIONS[@]}"; do
  fname=$(basename "$m")
  candidate1="supabase/rollbacks/$fname"
  candidate2="supabase/rollbacks/${fname%.*}.rollback.sql"
  candidate3="supabase/rollbacks/${fname%.*}.sql"

  if [[ -f "$candidate1" || -f "$candidate2" || -f "$candidate3" ]]; then
    echo "[migrations-check] Found rollback for $fname"
  else
    echo "[migrations-check][ERROR] Missing rollback for migration $fname"
    echo "  Expected one of:"
    echo "    - $candidate1"
    echo "    - $candidate2"
    echo "    - $candidate3"
    ERRORS=$((ERRORS+1))
  fi
done

if [ $ERRORS -gt 0 ]; then
  echo "[migrations-check] FAILED: $ERRORS error(s)."
  exit 1
fi

echo "[migrations-check] OK — append-only and rollback presence verified for new migrations."
exit 0
