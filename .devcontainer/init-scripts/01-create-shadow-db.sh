#!/bin/bash
###############################################################################
# PostgreSQL Init Script: Create Shadow Database
#
# This runs on first container start to create the shadow database needed
# for Supabase CLI migrations without requiring docker.sock access.
###############################################################################

set -e

echo "🔧 Creating shadow database for migrations..."

# Create shadow database if it doesn't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create shadow database for migrations
    SELECT 'CREATE DATABASE postgres_shadow'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'postgres_shadow')\gexec

    -- Grant permissions
    GRANT ALL PRIVILEGES ON DATABASE postgres_shadow TO postgres;
EOSQL

echo "✅ Shadow database ready"
