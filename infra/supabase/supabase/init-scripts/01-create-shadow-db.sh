#!/bin/bash
set -euo pipefail

# 01-create-shadow-db.sh
# Creates a shadow database for migration testing and validation
# This ensures migrations can be safely tested before applying to main database

echo "🗄️  Creating shadow database for migration testing..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" <<-EOSQL
    -- Create shadow database if it doesn't exist
    SELECT 'CREATE DATABASE ${POSTGRES_DB}_shadow'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${POSTGRES_DB}_shadow')\gexec

    -- Grant permissions to main user
    GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB}_shadow TO ${POSTGRES_USER};
EOSQL

# Initialize shadow database with same roles
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${POSTGRES_DB}_shadow" <<-EOSQL
    -- Enable required extensions (may already exist in supabase/postgres image)
    -- Wrapped to survive supautils hook that blocks pg_read_file
    DO \$\$
    BEGIN
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'pgcrypto: skipped (%)', SQLERRM;
    END
    \$\$;
    DO \$\$
    BEGIN
        CREATE EXTENSION IF NOT EXISTS "pgjwt";
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'pgjwt: skipped (%)', SQLERRM;
    END
    \$\$;
    DO \$\$
    BEGIN
        CREATE EXTENSION IF NOT EXISTS "vector";
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'vector: skipped (%)', SQLERRM;
    END
    \$\$;

    -- Create schemas
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE SCHEMA IF NOT EXISTS realtime;

    -- Grant permissions to roles
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
    GRANT USAGE ON SCHEMA realtime TO anon, authenticated, service_role;
EOSQL

echo "✅ Shadow database created successfully"
