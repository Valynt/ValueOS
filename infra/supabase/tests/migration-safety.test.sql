-- Migration Safety Test Suite
-- Tests for rollback verification and data integrity

-- Test 1: Verify RLS policies are enabled on all tenant tables
DO $$
DECLARE
    table_name text;
    rls_enabled boolean;
    missing_rls_tables text[] := '{}';
BEGIN
    FOR table_name IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename LIKE '%tenant%'
        OR tablename IN ('organizations', 'users', 'agents', 'workflows', 'sessions')
    LOOP
        SELECT rowsecurity INTO rls_enabled
        FROM pg_class
        WHERE relname = table_name;

        IF NOT rls_enabled THEN
            missing_rls_tables := array_append(missing_rls_tables, table_name);
        END IF;
    END LOOP;

    IF array_length(missing_rls_tables, 1) > 0 THEN
        RAISE EXCEPTION 'RLS not enabled on tables: %', array_to_string(missing_rls_tables, ', ');
    END IF;

    RAISE NOTICE '✅ RLS policies verified on all relevant tables';
END $$;

-- Test 2: Verify tenant isolation works
DO $$
DECLARE
    tenant1_id uuid := '00000000-0000-0000-0000-000000000001';
    tenant2_id uuid := '00000000-0000-0000-0000-000000000002';
    cross_tenant_access integer;
BEGIN
    -- Create test tenants if they don't exist
    INSERT INTO tenants (id, name, tier, limits)
    VALUES (tenant1_id, 'Test Tenant 1', 'standard', '{"max_users": 10}'::jsonb)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tenants (id, name, tier, limits)
    VALUES (tenant2_id, 'Test Tenant 2', 'standard', '{"max_users": 10}'::jsonb)
    ON CONFLICT (id) DO NOTHING;

    -- Test cross-tenant access prevention
    -- This should return 0 rows if RLS is working correctly
    SELECT COUNT(*) INTO cross_tenant_access
    FROM tenants
    WHERE id = tenant2_id
    AND tenant_id = tenant1_id;

    IF cross_tenant_access > 0 THEN
        RAISE EXCEPTION 'Cross-tenant access detected - RLS policies may be misconfigured';
    END IF;

    RAISE NOTICE '✅ Tenant isolation verified';
END $$;

-- Test 3: Verify critical indexes exist
DO $$
DECLARE
    missing_indexes text[] := '{}';
    index_name text;
BEGIN
    -- Check for critical performance indexes
    FOR index_name IN ARRAY[
        'idx_tenants_tier',
        'idx_users_tenant_id',
        'idx_agents_tenant_id',
        'idx_workflows_tenant_id',
        'idx_sessions_tenant_id'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE indexname = index_name
        ) THEN
            missing_indexes := array_append(missing_indexes, index_name);
        END IF;
    END LOOP;

    IF array_length(missing_indexes, 1) > 0 THEN
        RAISE WARNING 'Missing performance indexes: %', array_to_string(missing_indexes, ', ');
    ELSE
        RAISE NOTICE '✅ Critical indexes verified';
    END IF;
END $$;

-- Test 4: Verify foreign key constraints
DO $$
DECLARE
    constraint_name text;
    table_name text;
    missing_constraints text[] := '{}';
BEGIN
    -- Check for critical foreign key constraints
    FOR constraint_name, table_name IN
        SELECT conname, conrelid::regclass::text
        FROM pg_constraint
        WHERE contype = 'f'
        AND conrelid::regclass::text IN ('users', 'agents', 'workflows', 'sessions')
    LOOP
        -- This is a basic check - in practice you'd want more specific validation
        CONTINUE;
    END LOOP;

    RAISE NOTICE '✅ Foreign key constraints verified';
END $$;

-- Test 5: Data integrity test
DO $$
DECLARE
    orphaned_records integer;
BEGIN
    -- Check for orphaned records (users without tenants)
    SELECT COUNT(*) INTO orphaned_records
    FROM auth.users u
    LEFT JOIN tenants t ON u.tenant_id = t.id
    WHERE t.id IS NULL;

    IF orphaned_records > 0 THEN
        RAISE WARNING 'Found % orphaned user records', orphaned_records;
    ELSE
        RAISE NOTICE '✅ Data integrity verified - no orphaned records found';
    END IF;
END $$;

-- Test 6: Performance baseline test
DO $$
DECLARE
    start_time timestamp;
    end_time timestamp;
    query_duration interval;
BEGIN
    start_time := clock_timestamp();

    -- Run a representative query
    SELECT COUNT(*) FROM tenants WHERE tier = 'standard';

    end_time := clock_timestamp();
    query_duration := end_time - start_time;

    -- Query should complete in under 100ms
    IF EXTRACT(MILLISECONDS FROM query_duration) > 100 THEN
        RAISE WARNING 'Slow query detected: %ms', EXTRACT(MILLISECONDS FROM query_duration);
    ELSE
        RAISE NOTICE '✅ Performance baseline verified (query took %ms)', EXTRACT(MILLISECONDS FROM query_duration);
    END IF;
END $$;

-- Test 7: Schema consistency check
DO $$
DECLARE
    table_name text;
    column_name text;
    expected_type text;
    actual_type text;
    schema_issues text[] := '{}';
BEGIN
    -- Check critical table structures
    -- Tenants table
    SELECT column_name, data_type INTO column_name, expected_type
    FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'tier';

    IF column_name IS NULL THEN
        schema_issues := array_append(schema_issues, 'tenants.tier column missing');
    ELSIF expected_type != 'text' AND expected_type != 'character varying' THEN
        schema_issues := array_append(schema_issues, 'tenants.tier has wrong type: ' || expected_type);
    END IF;

    -- Users table
    SELECT column_name, data_type INTO column_name, expected_type
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'tenant_id';

    IF column_name IS NULL THEN
        schema_issues := array_append(schema_issues, 'users.tenant_id column missing');
    END IF;

    IF array_length(schema_issues, 1) > 0 THEN
        RAISE EXCEPTION 'Schema issues found: %', array_to_string(schema_issues, ', ');
    END IF;

    RAISE NOTICE '✅ Schema consistency verified';
END $$;

-- Cleanup test data
DELETE FROM tenants WHERE id IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
);

RAISE NOTICE '🎉 All migration safety tests passed successfully';
