-- ============================================================================
-- STAGING DATABASE CLEANUP SCRIPT
-- ============================================================================
-- Purpose: Clean development/test data before production deployment
-- Usage: Run this in STAGING environment ONLY after backup
-- DANGER: This will DELETE ALL data. DO NOT run in production.
-- ============================================================================

\echo '=========================================='
\echo 'Staging Database Cleanup'
\echo 'WARNING: This will delete ALL data'
\echo '=========================================='
\echo ''

-- Safety check: Verify you're in the correct environment
DO $$
DECLARE
    db_name TEXT;
BEGIN
    SELECT current_database() INTO db_name;
    
    IF db_name LIKE '%prod%' OR db_name LIKE '%production%' THEN
        RAISE EXCEPTION 'SAFETY CHECK FAILED: This appears to be a production database (%). Aborting cleanup.', db_name;
    END IF;
    
    RAISE NOTICE 'Database: %', db_name;
    RAISE NOTICE 'Proceeding with cleanup...';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- SECTION 1: BACKUP VERIFICATION
-- ============================================================================

\echo '1. Verifying backup exists...'

DO $$
DECLARE
    latest_backup RECORD;
BEGIN
    -- Check if backup log table exists and has recent backups
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'audit' AND tablename = 'backup_log') THEN
        SELECT * INTO latest_backup 
        FROM audit.backup_log 
        WHERE status = 'success' 
        ORDER BY created_at DESC 
        LIMIT 1;
        
        IF latest_backup IS NOT NULL THEN
            RAISE NOTICE '  ✅ Latest backup: % (% ago)', 
                latest_backup.created_at, 
                NOW() - latest_backup.created_at;
                
            IF NOW() - latest_backup.created_at > INTERVAL '24 hours' THEN
                RAISE WARNING '  ⚠️  Backup is older than 24 hours!';
            END IF;
        ELSE
            RAISE WARNING '  ⚠️  No successful backups found';
        END IF;
    ELSE
        RAISE NOTICE '  ℹ️  Backup log table not found (manual verification required)';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '  ⚠️  MANUAL VERIFICATION REQUIRED:';
    RAISE NOTICE '     Ensure you have a recent database backup before proceeding';
    RAISE NOTICE '     Run: supabase db dump -f backup-pre-cleanup-$(date +%%Y%%m%%d).sql';
    RAISE NOTICE '';
END $$;

-- Pause for confirmation (in interactive mode)
-- \prompt 'Type YES to continue with cleanup: ' confirm

-- ============================================================================
-- SECTION 2: ANALYZE CURRENT DATA
-- ============================================================================

\echo '2. Analyzing current data...'
\echo ''

DO $$
DECLARE
    table_stats RECORD;
    total_rows BIGINT := 0;
BEGIN
    RAISE NOTICE '  Current row counts:';
    
    FOR table_stats IN 
        SELECT 
            schemaname,
            tablename,
            n_live_tup as row_count
        FROM pg_stat_user_tables
        WHERE schemaname IN ('public', 'audit')
        ORDER BY n_live_tup DESC
    LOOP
        IF table_stats.row_count > 0 THEN
            RAISE NOTICE '    - %.%: % rows', 
                table_stats.schemaname, 
                table_stats.tablename, 
                table_stats.row_count;
            total_rows := total_rows + table_stats.row_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '  Total rows to delete: %', total_rows;
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- SECTION 3: DELETE TEST/DEVELOPMENT DATA
-- ============================================================================

\echo '3. Deleting test and development data...'
\echo ''

DO $$
DECLARE
    deleted_count INTEGER;
    total_deleted INTEGER := 0;
BEGIN
    -- Delete from all tables with organization_id (tenant data)
    -- Order matters: child tables first, then parent tables
    
    -- 3.1 Workflow-related data
    RAISE NOTICE '  Deleting workflow data...';
    
    DELETE FROM workflow_executions;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    total_deleted := total_deleted + deleted_count;
    RAISE NOTICE '    - workflow_executions: % rows', deleted_count;
    
    DELETE FROM workflow_definitions WHERE id NOT IN (
        SELECT unnest(ARRAY[]::uuid[]) -- Preserve specific workflows if needed
    );
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    total_deleted := total_deleted + deleted_count;
    RAISE NOTICE '    - workflow_definitions: % rows', deleted_count;
    
    -- 3.2 Agent-related data
    RAISE NOTICE '  Deleting agent data...';
    
    DELETE FROM agent_audit_log;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    total_deleted := total_deleted + deleted_count;
    RAISE NOTICE '    - agent_audit_log: % rows', deleted_count;
    
    DELETE FROM semantic_memory;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    total_deleted := total_deleted + deleted_count;
    RAISE NOTICE '    - semantic_memory: % rows', deleted_count;
    
    -- 3.3 Billing-related data (if exists)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'billing_usage_events') THEN
        RAISE NOTICE '  Deleting billing data...';
        
        DELETE FROM billing_invoice_items;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        total_deleted := total_deleted + deleted_count;
        RAISE NOTICE '    - billing_invoice_items: % rows', deleted_count;
        
        DELETE FROM billing_invoices;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        total_deleted := total_deleted + deleted_count;
        RAISE NOTICE '    - billing_invoices: % rows', deleted_count;
        
        DELETE FROM billing_usage_daily_totals;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        total_deleted := total_deleted + deleted_count;
        RAISE NOTICE '    - billing_usage_daily_totals: % rows', deleted_count;
        
        DELETE FROM billing_usage_events;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        total_deleted := total_deleted + deleted_count;
        RAISE NOTICE '    - billing_usage_events: % rows', deleted_count;
        
        DELETE FROM billing_entitlements;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        total_deleted := total_deleted + deleted_count;
        RAISE NOTICE '    - billing_entitlements: % rows', deleted_count;
        
        DELETE FROM billing_subscriptions;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        total_deleted := total_deleted + deleted_count;
        RAISE NOTICE '    - billing_subscriptions: % rows', deleted_count;
    END IF;
    
    -- 3.4 User and organization data
    RAISE NOTICE '  Deleting user and organization data...';
    
    -- Delete user_tenants (multi-org memberships)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_tenants') THEN
        DELETE FROM user_tenants;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        total_deleted := total_deleted + deleted_count;
        RAISE NOTICE '    - user_tenants: % rows', deleted_count;
    END IF;
    
    -- Delete users (will cascade to related records)
    DELETE FROM users;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    total_deleted := total_deleted + deleted_count;
    RAISE NOTICE '    - users: % rows', deleted_count;
    
    -- Delete organizations (will cascade to all tenant-scoped data)
    DELETE FROM organizations;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    total_deleted := total_deleted + deleted_count;
    RAISE NOTICE '    - organizations: % rows', deleted_count;
    
    -- 3.5 Session and security data
    RAISE NOTICE '  Deleting session data...';
    
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'security' AND tablename = 'sessions') THEN
        DELETE FROM security.sessions;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        total_deleted := total_deleted + deleted_count;
        RAISE NOTICE '    - security.sessions: % rows', deleted_count;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'security' AND tablename = 'rate_limits') THEN
        DELETE FROM security.rate_limits;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        total_deleted := total_deleted + deleted_count;
        RAISE NOTICE '    - security.rate_limits: % rows', deleted_count;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '  Total rows deleted: %', total_deleted;
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- SECTION 4: KEEP AUDIT LOGS (OPTIONAL - COMMENT OUT TO DELETE)
-- ============================================================================

\echo '4. Audit log handling...'
\echo ''

DO $$
BEGIN
    RAISE NOTICE '  ℹ️  Keeping audit logs for compliance';
    RAISE NOTICE '     To delete audit logs, uncomment the DELETE statement in this section';
    RAISE NOTICE '';
    
    -- Uncomment to delete audit logs (⚠️ May violate compliance requirements)
    -- DELETE FROM audit.activity_log WHERE timestamp < NOW() - INTERVAL '90 days';
END $$;

-- ============================================================================
-- SECTION 5: RESET SEQUENCES (OPTIONAL)
-- ============================================================================

\echo '5. Resetting sequences...'
\echo ''

DO $$
DECLARE
    seq RECORD;
BEGIN
    -- Reset all sequences to start from 1
    FOR seq IN 
        SELECT sequence_schema, sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema IN ('public', 'security')
    LOOP
        EXECUTE format('ALTER SEQUENCE %I.%I RESTART WITH 1', 
            seq.sequence_schema, seq.sequence_name);
        RAISE NOTICE '  - Reset %.%', seq.sequence_schema, seq.sequence_name;
    END LOOP;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- SECTION 6: VACUUM AND ANALYZE
-- ============================================================================

\echo '6. Optimizing database...'
\echo ''

VACUUM FULL ANALYZE;

\echo '  ✅ Database vacuumed and analyzed'
\echo ''

-- ============================================================================
-- SECTION 7: VERIFY CLEANUP
-- ============================================================================

\echo '7. Verifying cleanup...'
\echo ''

DO $$
DECLARE
    table_stats RECORD;
    remaining_rows BIGINT := 0;
    non_empty_tables INTEGER := 0;
BEGIN
    RAISE NOTICE '  Remaining row counts:';
    
    FOR table_stats IN 
        SELECT 
            schemaname,
            tablename,
            n_live_tup as row_count
        FROM pg_stat_user_tables
        WHERE schemaname IN ('public', 'security')
          AND tablename NOT IN ('roles', 'feature_flags', 'billing_plans') -- System tables
        ORDER BY n_live_tup DESC
    LOOP
        IF table_stats.row_count > 0 THEN
            RAISE NOTICE '    - %.%: % rows', 
                table_stats.schemaname, 
                table_stats.tablename, 
                table_stats.row_count;
            remaining_rows := remaining_rows + table_stats.row_count;
            non_empty_tables := non_empty_tables + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    
    IF remaining_rows = 0 THEN
        RAISE NOTICE '  ✅ SUCCESS: All user data deleted';
    ELSIF non_empty_tables <= 5 THEN
        RAISE NOTICE '  ✅ SUCCESS: Cleanup complete (% system rows remaining)', remaining_rows;
    ELSE
        RAISE WARNING '  ⚠️  WARNING: % rows remaining in % tables', remaining_rows, non_empty_tables;
        RAISE NOTICE '     Review remaining data manually';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- SECTION 8: STORAGE CLEANUP (SUPABASE STORAGE)
-- ============================================================================

\echo '8. Storage bucket cleanup...'
\echo ''

DO $$
DECLARE
    bucket_count INTEGER;
    object_count INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
        -- Count storage objects
        SELECT count(*) INTO object_count FROM storage.objects;
        SELECT count(*) INTO bucket_count FROM storage.buckets;
        
        RAISE NOTICE '  ℹ️  Storage buckets: %', bucket_count;
        RAISE NOTICE '  ℹ️  Storage objects: %', object_count;
        RAISE NOTICE '';
        RAISE NOTICE '  ⚠️  MANUAL ACTION REQUIRED:';
        RAISE NOTICE '     Storage files must be deleted via Supabase Dashboard or CLI';
        RAISE NOTICE '     Run: supabase storage rm <bucket-name> --recursive';
        RAISE NOTICE '';
    ELSE
        RAISE NOTICE '  ℹ️  Supabase Storage not configured';
        RAISE NOTICE '';
    END IF;
END $$;

-- ============================================================================
-- SECTION 9: FINAL REPORT
-- ============================================================================

\echo '=========================================='
\echo 'Cleanup Complete'
\echo '=========================================='
\echo ''

DO $$
BEGIN
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. ✅ Verify cleanup with: SELECT * FROM security.health_check();';
    RAISE NOTICE '  2. ✅ Delete storage files via Supabase Dashboard';
    RAISE NOTICE '  3. ✅ Run migrations if needed: supabase db push';
    RAISE NOTICE '  4. ✅ Seed production data if required';
    RAISE NOTICE '  5. ✅ Test authentication and RLS policies';
    RAISE NOTICE '  6. ✅ Proceed with production deployment checklist';
    RAISE NOTICE '';
    RAISE NOTICE 'See: docs/deployment/PRE_PRODUCTION_CHECKLIST.md';
    RAISE NOTICE '';
END $$;

\echo '=========================================='
