#!/usr/bin/env bash
set -euo pipefail

MIGRATIONS_DIR="infra/supabase/supabase/migrations"
TIMESTAMP_PATTERN='^[0-9]{14}_.+\.sql$'

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "❌ Migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

invalid_files=()
while IFS= read -r file; do
  base="$(basename "$file")"
  if [[ ! "$base" =~ $TIMESTAMP_PATTERN ]]; then
    invalid_files+=("$base")
  fi
done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | sort)

if (( ${#invalid_files[@]} > 0 )); then
  echo "❌ Non-timestamp migration SQL files are not allowed in $MIGRATIONS_DIR:" >&2
  printf ' - %s\n' "${invalid_files[@]}" >&2
  echo "Move utility/seed/auth SQL files into infra/supabase/sql/..." >&2
  exit 1
fi

echo "✅ Migration filenames are valid in $MIGRATIONS_DIR"
