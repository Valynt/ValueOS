#!/bin/bash
set -e

# Parse arguments
STEPS=1
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --steps=*)
      STEPS="${1#*=}"
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--steps=N] [--dry-run]"
      echo "  --steps=N: Number of migrations to rollback (default: 1)"
      echo "  --dry-run: Show what would be done without applying"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage"
      exit 1
      ;;
  esac
done

MIGRATIONS_DIR="infra/supabase/supabase/migrations"
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-dev_password}"
DB_NAME="${DB_NAME:-valuecanvas_dev}"

echo "🔄 Rolling back database migrations..."

if $DRY_RUN; then
  echo "DRY RUN MODE: No changes will be applied"
fi

# Get applied migrations in reverse order
if ! $DRY_RUN; then
  APPLIED=$(PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT name FROM public.schema_migrations ORDER BY applied_at DESC" | xargs)
else
  APPLIED=""
fi

# Take first N migrations to rollback
ROLLBACK_LIST=($APPLIED)
ROLLBACK_COUNT=${#ROLLBACK_LIST[@]}
if [ $ROLLBACK_COUNT -lt $STEPS ]; then
  STEPS=$ROLLBACK_COUNT
fi

echo "Rolling back $STEPS migration(s)..."

for ((i=0; i<STEPS; i++)); do
  filename=${ROLLBACK_LIST[$i]}
  echo "🔄 Rolling back: $filename"

  # Assume rollback file exists as filename.rollback.sql
  rollback_file="$MIGRATIONS_DIR/${filename%.sql}.rollback.sql"
  if [ -f "$rollback_file" ]; then
    if ! $DRY_RUN; then
      PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$rollback_file"
      PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "DELETE FROM public.schema_migrations WHERE name = '$filename';"
    fi
  else
    echo "No rollback file found for $filename. Manual rollback required."
  fi
done

echo "✅ Rollback Complete."
