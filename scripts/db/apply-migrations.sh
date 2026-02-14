#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$PROJECT_ROOT/infra/supabase/supabase/migrations}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is required." >&2
  exit 2
fi

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "ERROR: Migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 2
fi

url_without_scheme="${DATABASE_URL#*://}"
authority_and_path="${url_without_scheme##*@}"
host_port="${authority_and_path%%/*}"
database_with_params="${authority_and_path#*/}"
database_name="${database_with_params%%\?*}"
host_name="${host_port%%:*}"

if [[ -z "$database_name" || "$database_name" == "$authority_and_path" ]]; then
  database_name="unknown"
fi
if [[ -z "$host_name" ]]; then
  host_name="unknown"
fi

echo "Applying migrations to host=$host_name db=$database_name"

declare -a migration_files=()
while IFS= read -r file; do
  migration_files+=("$file")
done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | LC_ALL=C sort)

if [[ ${#migration_files[@]} -eq 0 ]]; then
  echo "ERROR: No migration files found in $MIGRATIONS_DIR" >&2
  exit 3
fi

for file in "${migration_files[@]}"; do
  echo "==> Applying: $(basename "$file")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
  echo "==> Applied: $(basename "$file")"
done

echo "All migrations applied successfully."
