#!/bin/bash
###############################################################################
# PostgreSQL Init Script: Create Supabase Roles
#
# This runs FIRST on container start to create all Supabase-required roles
# needed by PostgREST, GoTrue (auth), Storage, and Realtime services.
###############################################################################

set -e

echo "🔧 Creating Supabase roles and schemas..."

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- =========================================================================
    -- Supabase Required Roles
    -- =========================================================================

    -- supabase_admin: Superuser for internal Supabase operations
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
            CREATE ROLE supabase_admin WITH LOGIN PASSWORD 'postgres' SUPERUSER CREATEDB CREATEROLE REPLICATION;
        END IF;
    END
    \$\$;

    -- authenticator: Used by PostgREST to connect (switches to anon/authenticated)
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
            CREATE ROLE authenticator WITH LOGIN PASSWORD 'postgres' NOINHERIT;
        END IF;
    END
    \$\$;

    -- anon: Anonymous role for unauthenticated API requests
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
            CREATE ROLE anon NOLOGIN NOINHERIT;
        END IF;
    END
    \$\$;

    -- authenticated: Role for authenticated API requests
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
            CREATE ROLE authenticated NOLOGIN NOINHERIT;
        END IF;
    END
    \$\$;

    -- service_role: Bypasses RLS for backend services
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
            CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
        END IF;
    END
    \$\$;

    -- supabase_auth_admin: Used by GoTrue auth service
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
            CREATE ROLE supabase_auth_admin WITH LOGIN PASSWORD 'postgres' NOINHERIT CREATEROLE;
        END IF;
    END
    \$\$;

    -- supabase_storage_admin: Used by Storage service
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
            CREATE ROLE supabase_storage_admin WITH LOGIN PASSWORD 'postgres' NOINHERIT;
        END IF;
    END
    \$\$;

    -- supabase_realtime_admin: Used by Realtime service
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
            CREATE ROLE supabase_realtime_admin WITH LOGIN PASSWORD 'postgres' NOINHERIT;
        END IF;
    END
    \$\$;

    -- =========================================================================
    -- Role Memberships (Grant role switching ability)
    -- =========================================================================
    GRANT anon TO authenticator;
    GRANT authenticated TO authenticator;
    GRANT service_role TO authenticator;
    GRANT supabase_admin TO authenticator;

    -- =========================================================================
    -- Required Schemas
    -- =========================================================================
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE SCHEMA IF NOT EXISTS graphql_public;
    CREATE SCHEMA IF NOT EXISTS _realtime;
    CREATE SCHEMA IF NOT EXISTS extensions;

    -- =========================================================================
    -- Schema Ownership & Permissions
    -- =========================================================================
    ALTER SCHEMA auth OWNER TO supabase_auth_admin;
    ALTER SCHEMA storage OWNER TO supabase_storage_admin;
    ALTER SCHEMA _realtime OWNER TO supabase_realtime_admin;

    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
    GRANT USAGE ON SCHEMA storage TO supabase_storage_admin;
    GRANT USAGE ON SCHEMA graphql_public TO anon, authenticated, service_role;

    -- Grant authenticator ability to use public schema
    GRANT USAGE ON SCHEMA public TO authenticator;

    -- Default privileges for future tables
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;

    -- =========================================================================
    -- Required Extensions
    -- =========================================================================
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
    CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
    CREATE EXTENSION IF NOT EXISTS pgjwt SCHEMA extensions;

    -- Grant extensions schema usage
    GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

EOSQL

echo "✅ Supabase roles and schemas created"
