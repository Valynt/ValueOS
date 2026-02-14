#!/bin/bash
set -e

# CONFIGURATION
MIGRATIONS_DIR="infra/supabase/supabase/migrations"
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-dev_password}"
DB_NAME="${DB_NAME:-valuecanvas_dev}"

echo "🔍 Checking for Database Drift..."

# 1. Check if DB is reachable
if ! PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; then
    echo "❌ Error: Cannot connect to database at $DB_HOST."
    exit 1
fi

# 2. Get list of applied migrations from DB
APPLIED=$(PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT name FROM public.schema_migrations ORDER BY name;" 2>/dev/null | xargs)

# 3. Get list of local migration files
LOCAL_FILES=$(ls $MIGRATIONS_DIR/*.sql | xargs -n 1 basename | sort)

# 4. Compare
DRIFT=0
for file in $LOCAL_FILES; do
    if [[ ! " $APPLIED " =~ " $file " ]]; then
        echo "⚠️  Pending Migration: $file"
        DRIFT=1
    fi
done

if [ $DRIFT -eq 1 ]; then
    echo "❌ Database is drifted. Pending migrations found."
    exit 1
else
    echo "✅ Database schema is consistent."
    exit 0
fi
