#!/bin/bash
set -euo pipefail

# Configurable parameters via environment variables
DB_RETRY_COUNT=${DB_RETRY_COUNT:-5}
DB_RETRY_DELAY=${DB_RETRY_DELAY:-2}
MIGRATION_RETRY_COUNT=${MIGRATION_RETRY_COUNT:-3}
MIGRATION_RETRY_DELAY=${MIGRATION_RETRY_DELAY:-5}

# Parse arguments
DRY_RUN=false
EXTREME_FORCE=false
PROMPT_DESTRUCTIVE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --extreme-force)
      EXTREME_FORCE=true
      shift
      ;;
    --prompt-destructive)
      PROMPT_DESTRUCTIVE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--extreme-force] [--prompt-destructive]"
      echo "  --dry-run: Show what would be done without applying"
      echo "  --extreme-force: Force apply even if risky"
      echo "  --prompt-destructive: Prompt before destructive changes"
      echo ""
      echo "Environment Variables:"
      echo "  DB_RETRY_COUNT: Number of retries for database connections ($DB_RETRY_COUNT)"
      echo "  DB_RETRY_DELAY: Delay between database connection retries ($DB_RETRY_DELAY)"
      echo "  MIGRATION_RETRY_COUNT: Number of retries for migration application ($MIGRATION_RETRY_COUNT)"
      echo "  MIGRATION_RETRY_DELAY: Delay between migration retries ($MIGRATION_RETRY_DELAY)"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage"
      exit 1
      ;;
  esac
done

MIGRATIONS_DIR="infra/postgres/migrations"
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-valueos}"

# Retry a command with a maximum number of attempts and a delay between retries
retry_command() {
  local retries=$1
  local delay=$2
  shift 2
  local command=("$@")
  local count=0

  until "${command[@]}"; do
    exit_code=$?
    count=$((count+1))

    if [ $count -ge $retries ]; then
      echo "Command failed after $retries attempts."
      return $exit_code
    fi

    echo "Attempt $count/$retries failed. Retrying in $delay seconds..."
    sleep $delay
  done
}

echo "🔄 Syncing Database..."
echo "Configuration: DB_RETRY_COUNT=$DB_RETRY_COUNT, DB_RETRY_DELAY=$DB_RETRY_DELAY, MIGRATION_RETRY_COUNT=$MIGRATION_RETRY_COUNT, MIGRATION_RETRY_DELAY=$MIGRATION_RETRY_DELAY"

if $DRY_RUN; then
  echo "DRY RUN MODE: No changes will be applied"
fi

# Ensure migrations table exists with retry
if ! $DRY_RUN; then
  retry_command "$DB_RETRY_COUNT" "$DB_RETRY_DELAY" env PGPASSWORD="${DB_PASSWORD:-}" psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "CREATE TABLE IF NOT EXISTS public.schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMP DEFAULT NOW());"
fi

# Get applied migrations
if ! $DRY_RUN; then
  APPLIED=$(env PGPASSWORD="${DB_PASSWORD:-}" psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT name FROM public.schema_migrations" | xargs)
else
  APPLIED=""
fi

# Iterate and apply
for file_path in $MIGRATIONS_DIR/*.sql; do
    filename=$(basename "$file_path")

    if [[ ! " $APPLIED " =~ " $filename " ]]; then
        echo "🚀 Applying: $filename"
        if ! $DRY_RUN; then
          retry_command "$MIGRATION_RETRY_COUNT" "$MIGRATION_RETRY_DELAY" env PGPASSWORD="${DB_PASSWORD:-}" psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" <<SQL
BEGIN;
\i $file_path
INSERT INTO public.schema_migrations (name) VALUES ('$filename');
COMMIT;
SQL
        fi
    fi
done

echo "✅ Database Sync Complete."
