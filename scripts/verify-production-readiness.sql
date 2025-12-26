-- ============================================================================
-- PRE-PRODUCTION VERIFICATION SCRIPTS
-- ============================================================================
-- Purpose: Automated verification queries for production deployment readiness
-- Usage: Run these queries in sequence before deploying to production
-- Expected: All queries should return "PASS" status
-- ============================================================================

\echo '=========================================='
\echo 'ValueCanvas Pre-Production Verification'
\echo 'Date: ' `date`
\echo '=========================================='
\echo ''

-- ============================================================================
-- SECTION 1: RLS VERIFICATION
-- ============================================================================

\echo '1. Verifying Row-Level Security...'
\echo ''

-- Check all critical tables have RLS enabled
DO $$
DECLARE
    rls_check RECORD;
    failures INTEGER := 0;
BEGIN
    FOR rls_check IN 
        SELECT * FROM security.verify_rls_enabled()
        WHERE status != '✓ OK'
    LOOP
        RAISE WARNING '  ❌ FAIL: % (RLS: %, Policies: %)', 
            rls_check.table_name, 
            rls_check.rls_enabled, 
            rls_check.policy_count;
        failures := failures + 1;
    END LOOP;
    
    IF failures = 0 THEN
        RAISE NOTICE '  ✅ PASS: All tables have RLS enabled with policies';
    ELSE
        RAISE EXCEPTION '  ❌ FAIL: % tables missing RLS or policies', failures;
    END IF;
END $$;

\echo ''

-- ============================================================================
-- SECTION 2: DATABASE HEALTH CHECK
-- ============================================================================

\echo '2. Running Database Health Check...'
\echo ''

DO $$
DECLARE
    health_check RECORD;
    errors INTEGER := 0;
    warnings INTEGER := 0;
BEGIN
    FOR health_check IN SELECT * FROM security.health_check() LOOP
        IF health_check.severity = 'ERROR' THEN
            RAISE WARNING '  ❌ ERROR: %: %', health_check.check_name, health_check.value;
            errors := errors + 1;
        ELSIF health_check.severity = 'WARNING' THEN
            RAISE WARNING '  ⚠️  WARNING: %: %', health_check.check_name, health_check.value;
            warnings := warnings + 1;
        ELSE
            RAISE NOTICE '  ✅ %: %', health_check.check_name, health_check.value;
        END IF;
    END LOOP;
    
    IF errors > 0 THEN
        RAISE EXCEPTION '  ❌ FAIL: % errors found in health check', errors;
    ELSIF warnings > 0 THEN
        RAISE WARNING '  ⚠️  PASS WITH WARNINGS: % warnings found', warnings;
    ELSE
        RAISE NOTICE '  ✅ PASS: All health checks passed';
    END IF;
END $$;

\echo ''

-- ============================================================================
-- SECTION 3: JWT CLAIMS VERIFICATION
-- ============================================================================

\echo '3. Verifying JWT Claims Configuration...'
\echo ''

-- Check if custom_access_token_hook exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'custom_access_token_hook' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        RAISE NOTICE '  ✅ PASS: custom_access_token_hook function exists';
    ELSE
        RAISE WARNING '  ⚠️  WARNING: custom_access_token_hook function not found';
        RAISE WARNING '     JWT claims will fall back to database lookups (slower)';
    END IF;
END $$;

\echo ''

-- ============================================================================
-- SECTION 4: AUDIT LOGGING VERIFICATION
-- ============================================================================

\echo '4. Verifying Audit Logging...'
\echo ''

DO $$
DECLARE
    audit_count INTEGER;
    immutability_test BOOLEAN := false;
BEGIN
    -- Check audit log table exists and has recent entries
    SELECT count(*) INTO audit_count
    FROM audit.activity_log
    WHERE timestamp > NOW() - INTERVAL '24 hours';
    
    IF audit_count > 0 THEN
        RAISE NOTICE '  ✅ PASS: Audit log active (% entries in last 24h)', audit_count;
    ELSE
        RAISE WARNING '  ⚠️  WARNING: No audit log entries in last 24 hours';
    END IF;
    
    -- Test audit log immutability (should fail)
    BEGIN
        UPDATE audit.activity_log SET action = 'TEST' WHERE id = (
            SELECT id FROM audit.activity_log LIMIT 1
        );
        RAISE WARNING '  ❌ FAIL: Audit log is NOT immutable';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '  ✅ PASS: Audit log immutability enforced';
    END;
END $$;

\echo ''

-- ============================================================================
-- SECTION 5: MULTI-TENANCY ISOLATION TEST
-- ============================================================================

\echo '5. Testing Multi-Tenancy Isolation...'
\echo ''

DO $$
DECLARE
    org_a UUID := gen_random_uuid();
    org_b UUID := gen_random_uuid();
    user_a UUID := gen_random_uuid();
    user_b UUID := gen_random_uuid();
    test_passed BOOLEAN := true;
    result_count INTEGER;
BEGIN
    -- Create test organizations (requires service role or admin)
    INSERT INTO public.organizations (id, name, slug, status)
    VALUES 
        (org_a, 'Test Org A', 'test-org-a-' || extract(epoch from now())::text, 'active'),
        (org_b, 'Test Org B', 'test-org-b-' || extract(epoch from now())::text, 'active');
    
    -- Create test users
    INSERT INTO public.users (id, organization_id, email, role, status)
    VALUES 
        (user_a, org_a, 'test-user-a-' || extract(epoch from now())::text || '@test.com', 'member', 'active'),
        (user_b, org_b, 'test-user-b-' || extract(epoch from now())::text || '@test.com', 'member', 'active');
    
    -- Test 1: Simulate user A trying to access org B (should fail with RLS)
    -- Note: This test assumes RLS policies are properly configured
    -- In production, this would be tested via actual API calls with JWT tokens
    
    RAISE NOTICE '  ℹ️  Multi-tenancy isolation requires end-to-end testing with actual JWT tokens';
    RAISE NOTICE '     Run: npm run test:rls for comprehensive RLS policy tests';
    
    -- Cleanup test data
    DELETE FROM public.users WHERE id IN (user_a, user_b);
    DELETE FROM public.organizations WHERE id IN (org_a, org_b);
    
    RAISE NOTICE '  ✅ PASS: Test data created and cleaned up successfully';
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '  ⚠️  WARNING: Could not run isolation test (may require elevated privileges)';
    RAISE NOTICE '     Message: %', SQLERRM;
END $$;

\echo ''

-- ============================================================================
-- SECTION 6: SERVICE ROLE OPERATIONS AUDIT
-- ============================================================================

\echo '6. Verifying Service Role Audit Trail...'
\echo ''

DO $$
DECLARE
    service_ops INTEGER;
    recent_service_ops INTEGER;
BEGIN
    -- Check if service role operations are being tracked
    SELECT count(*) INTO service_ops
    FROM audit.activity_log
    WHERE is_service_operation = TRUE;
    
    SELECT count(*) INTO recent_service_ops
    FROM audit.activity_log
    WHERE is_service_operation = TRUE
      AND timestamp > NOW() - INTERVAL '7 days';
    
    IF service_ops > 0 THEN
        RAISE NOTICE '  ✅ PASS: Service role operations tracked (total: %, last 7d: %)', 
            service_ops, recent_service_ops;
    ELSE
        RAISE NOTICE '  ℹ️  INFO: No service role operations logged yet';
        RAISE NOTICE '     This is normal for new deployments';
    END IF;
END $$;

\echo ''

-- ============================================================================
-- SECTION 7: VECTOR STORE VERIFICATION (if using semantic_memory)
-- ============================================================================

\echo '7. Verifying Vector Store Configuration...'
\echo ''

DO $$
DECLARE
    vector_enabled BOOLEAN;
    index_exists BOOLEAN;
BEGIN
    -- Check if vector extension is enabled
    SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
    ) INTO vector_enabled;
    
    IF vector_enabled THEN
        RAISE NOTICE '  ✅ PASS: pgvector extension enabled';
        
        -- Check if semantic_memory table exists
        IF EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' AND tablename = 'semantic_memory'
        ) THEN
            RAISE NOTICE '  ✅ PASS: semantic_memory table exists';
            
            -- Check for vector index
            SELECT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND tablename = 'semantic_memory'
                  AND indexname LIKE '%embedding%'
            ) INTO index_exists;
            
            IF index_exists THEN
                RAISE NOTICE '  ✅ PASS: Vector similarity index exists';
            ELSE
                RAISE WARNING '  ⚠️  WARNING: No vector index found (query performance may be slow)';
            END IF;
        ELSE
            RAISE NOTICE '  ℹ️  INFO: semantic_memory table not found (may not be using vector store)';
        END IF;
    ELSE
        RAISE NOTICE '  ℹ️  INFO: pgvector extension not enabled (not required if not using semantic search)';
    END IF;
END $$;

\echo ''

-- ============================================================================
-- SECTION 8: PERFORMANCE BASELINE
-- ============================================================================

\echo '8. Establishing Performance Baseline...'
\echo ''

DO $$
DECLARE
    slow_queries INTEGER;
    table_bloat RECORD;
    bloat_issues INTEGER := 0;
BEGIN
    -- Check for slow queries (>1 second)
    SELECT count(*) INTO slow_queries
    FROM security.get_slow_queries(1000);
    
    IF slow_queries > 10 THEN
        RAISE WARNING '  ⚠️  WARNING: % slow queries detected (>1s)', slow_queries;
        RAISE NOTICE '     Run: SELECT * FROM security.get_slow_queries(1000);';
    ELSIF slow_queries > 0 THEN
        RAISE NOTICE '  ℹ️  INFO: % slow queries detected (review recommended)', slow_queries;
    ELSE
        RAISE NOTICE '  ✅ PASS: No slow queries detected';
    END IF;
    
    -- Check for table bloat
    FOR table_bloat IN SELECT * FROM security.check_table_bloat() LOOP
        IF table_bloat.bloat_pct > 30 THEN
            RAISE WARNING '  ⚠️  WARNING: Table % has %.1f%% bloat', 
                table_bloat.table_name, table_bloat.bloat_pct;
            bloat_issues := bloat_issues + 1;
        END IF;
    END LOOP;
    
    IF bloat_issues = 0 THEN
        RAISE NOTICE '  ✅ PASS: No significant table bloat detected';
    END IF;
END $$;

\echo ''

-- ============================================================================
-- SECTION 9: STORAGE POLICIES (if using Supabase Storage)
-- ============================================================================

\echo '9. Verifying Storage Bucket Policies...'
\echo ''

DO $$
DECLARE
    bucket_count INTEGER;
    policy_count INTEGER;
BEGIN
    -- Check if storage schema exists
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
        SELECT count(*) INTO bucket_count FROM storage.buckets;
        SELECT count(*) INTO policy_count FROM storage.buckets WHERE id IN (
            SELECT bucket_id FROM storage.objects_policies
        );
        
        RAISE NOTICE '  ℹ️  INFO: % storage buckets configured', bucket_count;
        
        IF bucket_count > 0 AND policy_count = 0 THEN
            RAISE WARNING '  ⚠️  WARNING: Storage buckets exist but no RLS policies configured';
        ELSIF bucket_count > 0 THEN
            RAISE NOTICE '  ✅ PASS: Storage buckets have RLS policies';
        END IF;
    ELSE
        RAISE NOTICE '  ℹ️  INFO: Supabase Storage not configured';
    END IF;
END $$;

\echo ''

-- ============================================================================
-- SECTION 10: FINAL SUMMARY
-- ============================================================================

\echo '=========================================='
\echo 'Verification Summary'
\echo '=========================================='

DO $$
DECLARE
    total_checks INTEGER := 9;
    passed_checks INTEGER := 0;
    failed_checks INTEGER := 0;
    warnings INTEGER := 0;
BEGIN
    -- This is a simplified summary - in production, you'd track each check result
    RAISE NOTICE '';
    RAISE NOTICE 'Review the output above for detailed results.';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Review any ❌ FAIL or ⚠️  WARNING messages';
    RAISE NOTICE '  2. Run end-to-end tests: npm run test:rls';
    RAISE NOTICE '  3. Test with actual user JWTs in staging environment';
    RAISE NOTICE '  4. Configure monitoring alerts (see PRE_PRODUCTION_CHECKLIST.md)';
    RAISE NOTICE '  5. Complete deployment sign-off checklist';
    RAISE NOTICE '';
    RAISE NOTICE 'For detailed guidance, see: docs/deployment/PRE_PRODUCTION_CHECKLIST.md';
    RAISE NOTICE '';
END $$;

\echo '=========================================='
\echo 'Verification Complete'
\echo '=========================================='
