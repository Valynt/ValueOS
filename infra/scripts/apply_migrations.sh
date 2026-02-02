#!/bin/bash
set -e

MIGRATIONS_DIR="infra/postgres/migrations"
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-valueos}"

echo "🔄 Syncing Database..."

# Ensure migrations table exists
PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "CREATE TABLE IF NOT EXISTS public.schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMP DEFAULT NOW());" > /dev/null

# Get applied migrations
APPLIED=$(PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT name FROM public.schema_migrations" | xargs)

# Iterate and apply
for file_path in $MIGRATIONS_DIR/*.sql; do
    filename=$(basename "$file_path")

    if [[ ! " $APPLIED " =~ " $filename " ]]; then
        echo "🚀 Applying: $filename"
        PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$file_path"

        PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "INSERT INTO public.schema_migrations (name) VALUES ('$filename');"
    fi
done

echo "✅ Database Sync Complete."
