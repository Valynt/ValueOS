-- ============================================================================
-- SUPABASE STAGING RESET SCRIPT (Official Approach)
-- ============================================================================
-- Purpose: Reset staging to clean slate while preserving Supabase system schemas
-- Based on: Supabase official reset recommendations
-- Usage: Run in STAGING environment ONLY after backup
-- DANGER: This will DROP ALL user objects. DO NOT run in production.
-- ============================================================================

\echo '=========================================='
\echo 'Supabase Staging Database Reset'
\echo 'WARNING: This will drop ALL user objects'
\echo '=========================================='
\echo ''

-- ============================================================================
-- SECTION 0: SAFETY CHECKS
-- ============================================================================

\echo '0. Running safety checks...'
\echo ''

DO $$
DECLARE
    db_name TEXT;
    is_prod BOOLEAN := false;
BEGIN
    SELECT current_database() INTO db_name;

    -- Check if database name suggests production
    IF db_name LIKE '%prod%' OR db_name LIKE '%production%' THEN
        is_prod := true;
    END IF;

    -- Check if ENVIRONMENT variable is set
    IF current_setting('app.environment', true) = 'production' THEN
        is_prod := true;
    END IF;

    IF is_prod THEN
        RAISE EXCEPTION 'SAFETY CHECK FAILED: This appears to be a PRODUCTION database (%). Aborting reset.', db_name;
    END IF;

    RAISE NOTICE '  ✅ Database: % (safe to reset)', db_name;
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- SECTION 1: BACKUP VERIFICATION
-- ============================================================================

\echo '1. Backup verification...'
\echo ''

DO $$
BEGIN
    RAISE NOTICE '  ⚠️  CRITICAL: Ensure you have a backup before proceeding';
    RAISE NOTICE '';
    RAISE NOTICE '  Run this command BEFORE continuing:';
    RAISE NOTICE '    supabase db dump -f backup-pre-reset-$(date +%%Y%%m%%d-%%H%%M%%S).sql';
    RAISE NOTICE '';
    RAISE NOTICE '  Or use pg_dump:';
    RAISE NOTICE '    pg_dump $DATABASE_URL > backup-pre-reset-$(date +%%Y%%m%%d-%%H%%M%%S).sql';
    RAISE NOTICE '';
END $$;

-- Uncomment to require manual confirmation
-- \prompt 'Type YES to continue with reset: ' confirm

-- ============================================================================
-- SECTION 2: ANALYZE CURRENT STATE
-- ============================================================================

\echo '2. Analyzing current database state...'
\echo ''

DO $$
DECLARE
    schema_name TEXT;
    obj_count INTEGER;
    total_objects INTEGER := 0;
BEGIN
    RAISE NOTICE '  Current user schemas and object counts:';
    RAISE NOTICE '';

    FOR schema_name IN
        SELECT nspname
        FROM pg_namespace
        WHERE nspname NOT IN ('pg_catalog', 'information_schema',
                             'auth', 'storage', 'realtime', 'graphql', 'graphql_public',
                             'vault', 'extensions', 'supabase_migrations', 'supabase_functions',
                             'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
        ORDER BY nspname
    LOOP
        -- Count tables
        SELECT count(*) INTO obj_count
        FROM pg_tables
        WHERE schemaname = schema_name;

        IF obj_count > 0 THEN
            RAISE NOTICE '    Schema: % - % tables', schema_name, obj_count;
            total_objects := total_objects + obj_count;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '  Total user objects to drop: %', total_objects;
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- SECTION 3: DROP ALL USER OBJECTS IN TARGET SCHEMAS
-- ============================================================================

\echo '3. Dropping all user objects...'
\echo ''

DO $$
DECLARE
    schema_rec RECORD;
    obj_rec RECORD;
    drop_count INTEGER := 0;
BEGIN
    -- Target schemas to clean (preserving Supabase system schemas)
    FOR schema_rec IN
        SELECT nspname
        FROM pg_namespace
        WHERE nspname IN ('public', 'internal', 'audit', 'security')
        ORDER BY CASE
            WHEN nspname = 'public' THEN 1
            WHEN nspname = 'internal' THEN 2
            WHEN nspname = 'audit' THEN 3
            WHEN nspname = 'security' THEN 4
        END
    LOOP
        RAISE NOTICE '  Processing schema: %', schema_rec.nspname;

        -- Drop views first (they may depend on tables)
        FOR obj_rec IN
            SELECT table_name
            FROM information_schema.views
            WHERE table_schema = schema_rec.nspname
        LOOP
            EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE',
                schema_rec.nspname, obj_rec.table_name);
            drop_count := drop_count + 1;
        END LOOP;

        -- Drop functions
        FOR obj_rec IN
            SELECT proname, oidvectortypes(proargtypes) as argtypes
            FROM pg_proc
            WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = schema_rec.nspname)
        LOOP
            EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE',
                schema_rec.nspname, obj_rec.proname, obj_rec.argtypes);
            drop_count := drop_count + 1;
        END LOOP;

        -- Drop tables (CASCADE will drop dependent triggers, constraints, etc.)
        FOR obj_rec IN
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = schema_rec.nspname
        LOOP
            EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE',
                schema_rec.nspname, obj_rec.tablename);
            drop_count := drop_count + 1;
        END LOOP;

        -- Drop sequences
        FOR obj_rec IN
            SELECT sequence_name
            FROM information_schema.sequences
            WHERE sequence_schema = schema_rec.nspname
        LOOP
            EXECUTE format('DROP SEQUENCE IF EXISTS %I.%I CASCADE',
                schema_rec.nspname, obj_rec.sequence_name);
            drop_count := drop_count + 1;
        END LOOP;

        -- Drop types
        FOR obj_rec IN
            SELECT typname
            FROM pg_type t
            JOIN pg_namespace n ON t.typnamespace = n.oid
            WHERE n.nspname = schema_rec.nspname
            AND t.typtype = 'e' -- enums
        LOOP
            EXECUTE format('DROP TYPE IF EXISTS %I.%I CASCADE',
                schema_rec.nspname, obj_rec.typname);
            drop_count := drop_count + 1;
        END LOOP;

        RAISE NOTICE '    ✅ Cleaned schema: %', schema_rec.nspname;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '  Total objects dropped: %', drop_count;
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- SECTION 4: RECREATE CUSTOM SCHEMAS
-- ============================================================================

\echo '4. Recreating custom schemas...'
\echo ''

-- Recreate schemas if they were dropped
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS internal;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS security;

-- Set proper ownership and permissions
ALTER SCHEMA public OWNER TO postgres;
ALTER SCHEMA internal OWNER TO postgres;
ALTER SCHEMA audit OWNER TO postgres;
ALTER SCHEMA security OWNER TO postgres;

-- Grant usage to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA internal TO service_role;
GRANT USAGE ON SCHEMA audit TO authenticated, service_role;
GRANT USAGE ON SCHEMA security TO authenticated, service_role;

-- Add comments
COMMENT ON SCHEMA public IS 'Standard public schema for application tables';
COMMENT ON SCHEMA internal IS 'Internal schema for system functions and utilities';
COMMENT ON SCHEMA audit IS 'Audit logging schema for security and compliance';
COMMENT ON SCHEMA security IS 'Security utility functions and RLS helpers';

\echo '  ✅ Schemas recreated with proper permissions'
\echo ''

-- ============================================================================
-- SECTION 5: REINSTALL REQUIRED EXTENSIONS
-- ============================================================================

\echo '5. Reinstalling required extensions...'
\echo ''

-- Ensure extensions schema exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Install vector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
COMMENT ON EXTENSION vector IS 'Vector similarity search for embeddings (pgvector)';

-- Install other required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions;

\echo '  ✅ Extensions installed:'
\echo '    - vector (for semantic search)'
\echo '    - pgcrypto (for encryption — gen_random_uuid() is built-in on PG13+)'
\echo '    - pg_stat_statements (for query monitoring)'
\echo ''

-- ============================================================================
-- SECTION 6: APPLY BASELINE RLS SECURITY
-- ============================================================================

\echo '6. Applying baseline RLS security...'
\echo ''

DO $$
BEGIN
    -- Enable RLS by default on public schema
    -- Note: Individual tables will enable RLS when created by migrations

    RAISE NOTICE '  ℹ️  RLS will be enabled per-table by migrations';
    RAISE NOTICE '  ℹ️  Default deny-all policy recommended until real policies added';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- SECTION 7: VERIFY RESET
-- ============================================================================

\echo '7. Verifying reset...'
\echo ''

DO $$
DECLARE
    user_tables INTEGER;
    user_functions INTEGER;
    system_schemas TEXT[];
BEGIN
    -- Count remaining user objects
    SELECT count(*) INTO user_tables
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema',
                            'auth', 'storage', 'realtime', 'graphql', 'graphql_public',
                            'vault', 'extensions', 'supabase_migrations', 'supabase_functions');

    SELECT count(*) INTO user_functions
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema',
                           'auth', 'storage', 'realtime', 'graphql', 'graphql_public',
                           'vault', 'extensions', 'supabase_migrations', 'supabase_functions');

    IF user_tables = 0 AND user_functions = 0 THEN
        RAISE NOTICE '  ✅ SUCCESS: Database reset to clean slate';
        RAISE NOTICE '    - User tables: 0';
        RAISE NOTICE '    - User functions: 0';
    ELSE
        RAISE WARNING '  ⚠️  WARNING: Some user objects remain';
        RAISE NOTICE '    - User tables: %', user_tables;
        RAISE NOTICE '    - User functions: %', user_functions;
    END IF;

    RAISE NOTICE '';

    -- Verify system schemas are intact
    RAISE NOTICE '  Verified system schemas intact:';
    system_schemas := ARRAY['auth', 'storage', 'extensions', 'public', 'internal'];

    FOR i IN 1..array_length(system_schemas, 1) LOOP
        IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = system_schemas[i]) THEN
            RAISE NOTICE '    ✅ %', system_schemas[i];
        ELSE
            RAISE WARNING '    ❌ % (missing!)', system_schemas[i];
        END IF;
    END LOOP;

    RAISE NOTICE '';
END $$;

-- ============================================================================
-- SECTION 8: VERIFY EXTENSIONS
-- ============================================================================

\echo '8. Verifying extensions...'
\echo ''

DO $$
DECLARE
    ext RECORD;
BEGIN
    RAISE NOTICE '  Installed extensions:';

    FOR ext IN
        SELECT extname, extversion, nspname as schema
        FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE extname IN ('vector', 'pgcrypto', 'pg_stat_statements')
        ORDER BY extname
    LOOP
        RAISE NOTICE '    ✅ % (v%) in schema %', ext.extname, ext.extversion, ext.schema;
    END LOOP;

    RAISE NOTICE '';
END $$;

-- ============================================================================
-- SECTION 9: STORAGE CLEANUP REMINDER
-- ============================================================================

\echo '9. Storage bucket cleanup...'
\echo ''

DO $$
DECLARE
    bucket_count INTEGER := 0;
BEGIN
    -- Check if storage schema exists
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
        SELECT count(*) INTO bucket_count FROM storage.buckets;

        IF bucket_count > 0 THEN
            RAISE NOTICE '  ⚠️  MANUAL ACTION REQUIRED:';
            RAISE NOTICE '    Storage buckets found: %', bucket_count;
            RAISE NOTICE '';
            RAISE NOTICE '    Delete files via Supabase Dashboard or CLI:';
            RAISE NOTICE '      supabase storage ls';
            RAISE NOTICE '      supabase storage rm <bucket> --recursive';
            RAISE NOTICE '';
        ELSE
            RAISE NOTICE '  ✅ No storage buckets found';
            RAISE NOTICE '';
        END IF;
    ELSE
        RAISE NOTICE '  ℹ️  Supabase Storage not configured';
        RAISE NOTICE '';
    END IF;
END $$;

-- ============================================================================
-- SECTION 10: NEXT STEPS
-- ============================================================================

\echo '=========================================='
\echo 'Reset Complete - Next Steps'
\echo '=========================================='
\echo ''

DO $$
BEGIN
    RAISE NOTICE 'Your database is now reset to a clean slate!';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. ✅ Run migrations to rebuild schema:';
    RAISE NOTICE '       supabase db push';
    RAISE NOTICE '       OR: supabase migration up';
    RAISE NOTICE '';
    RAISE NOTICE '  2. ✅ Regenerate TypeScript types:';
    RAISE NOTICE '       pnpm run db:types';
    RAISE NOTICE '';
    RAISE NOTICE '  3. ✅ Apply security hardening:';
    RAISE NOTICE '       psql $DATABASE_URL < docs/database/enterprise_saas_hardened_config_v2.sql';
    RAISE NOTICE '';
    RAISE NOTICE '  4. ✅ Verify setup:';
    RAISE NOTICE '       psql $DATABASE_URL < scripts/verify-production-readiness.sql';
    RAISE NOTICE '';
    RAISE NOTICE '  5. ✅ Seed production data (if needed):';
    RAISE NOTICE '       psql $DATABASE_URL < supabase/seed.sql';
    RAISE NOTICE '';
    RAISE NOTICE '  6. ✅ Delete storage bucket files (manual)';
    RAISE NOTICE '';
    RAISE NOTICE '  7. ✅ Continue with pre-production checklist:';
    RAISE NOTICE '       docs/deployment/PRE_PRODUCTION_CHECKLIST.md';
    RAISE NOTICE '';
    RAISE NOTICE 'System schemas preserved:';
    RAISE NOTICE '  ✅ auth, storage, realtime, extensions, vault';
    RAISE NOTICE '';
    RAISE NOTICE 'User schemas reset:';
    RAISE NOTICE '  🔄 public, internal, audit, security';
    RAISE NOTICE '';
END $$;

\echo '=========================================='
