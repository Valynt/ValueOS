#!/bin/bash
set -euo pipefail

# 00-create-supabase-roles.sh
# Creates Supabase-compatible roles and permissions for local development
# This script runs automatically during PostgreSQL container initialization

echo "🔐 Creating Supabase roles and permissions..."

# Create roles required by Supabase
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create anon role (for anonymous API access)
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
            CREATE ROLE anon NOLOGIN NOINHERIT;
            GRANT USAGE ON SCHEMA public TO anon;
            GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
        END IF;
    END
    \$\$;

    -- Create authenticated role (for authenticated users)
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
            CREATE ROLE authenticated NOLOGIN NOINHERIT;
            GRANT USAGE ON SCHEMA public TO authenticated;
            GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
            GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
            GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
        END IF;
    END
    \$\$;

    -- Create service_role (for service-level operations)
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
            CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
            GRANT ALL ON SCHEMA public TO service_role;
            GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
            GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
            GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
        END IF;
    END
    \$\$;

    -- Create authenticator role (used by PostgREST)
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticator') THEN
            CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'authenticator_password';
            GRANT anon TO authenticator;
            GRANT authenticated TO authenticator;
            GRANT service_role TO authenticator;
        END IF;
    END
    \$\$;

    -- Create supabase_admin role
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'supabase_admin') THEN
            CREATE ROLE supabase_admin LOGIN CREATEROLE CREATEDB REPLICATION BYPASSRLS PASSWORD 'supabase_admin_password';
            GRANT ALL ON SCHEMA public TO supabase_admin;
            GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_admin;
            GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO supabase_admin;
            GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO supabase_admin;
        END IF;
    END
    \$\$;

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

    -- Grant execute permissions on extensions
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

    -- Create auth schema for Supabase Auth
    CREATE SCHEMA IF NOT EXISTS auth;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    GRANT ALL ON SCHEMA auth TO supabase_admin;

    -- Create storage schema for Supabase Storage
    CREATE SCHEMA IF NOT EXISTS storage;
    GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
    GRANT ALL ON SCHEMA storage TO supabase_admin;

    -- Create realtime schema for Supabase Realtime
    CREATE SCHEMA IF NOT EXISTS realtime;
    GRANT USAGE ON SCHEMA realtime TO anon, authenticated, service_role;
    GRANT ALL ON SCHEMA realtime TO supabase_admin;
EOSQL

echo "✅ Supabase roles and permissions created successfully"
