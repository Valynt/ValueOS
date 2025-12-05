-- ============================================================================
-- RLS Policies Test Suite
-- Tests Row Level Security enforcement across all tables
-- ============================================================================

BEGIN;

-- Load pgTAP extension
SELECT plan(20);

-- ============================================================================
-- Test 1: Verify RLS is enabled on critical tables
-- ============================================================================
SELECT results_eq(
  $$
    SELECT tablename::text
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('cases', 'workflows', 'messages', 'agent_predictions')
      AND rowsecurity = true
    ORDER BY tablename
  $$,
  $$
    VALUES
      ('agent_predictions'::text),
      ('cases'::text),
      ('messages'::text),
      ('workflows'::text)
  $$,
  'RLS should be enabled on all critical tables'
);

-- ============================================================================
-- Test 2: Verify audit logs are immutable
-- ============================================================================
SELECT has_trigger(
  'audit_logs',
  'tr_protect_audit_logs',
  'Audit logs should have immutability trigger'
);

SELECT has_trigger(
  'security_audit_log',
  'tr_protect_security_audit',
  'Security audit log should have immutability trigger'
);

-- ============================================================================
-- Test 3: Verify service role has bypass policies
-- ============================================================================
SELECT results_eq(
  $$
    SELECT count(*)::int
    FROM pg_policies
    WHERE policyname LIKE '%service_role%'
      OR policyname LIKE '%Service role%'
  $$,
  $$
    VALUES (10)  -- Adjust based on actual count
  $$,
  'Service role should have bypass policies on key tables'
);

-- ============================================================================
-- Test 4: Test user isolation (cases table)
-- ============================================================================
-- Set up test data
INSERT INTO users (id, email, full_name)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'user1@test.local', 'User 1'),
  ('00000000-0000-0000-0000-000000000002', 'user2@test.local', 'User 2');

INSERT INTO cases (id, user_id, title, status)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'User 1 Case', 'active'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'User 2 Case', 'active');

-- Test as User 1
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SET ROLE authenticated;

SELECT results_eq(
  $$
    SELECT count(*)::int FROM cases
  $$,
  $$
    VALUES (1)
  $$,
  'User 1 should only see their own case'
);

-- Reset
RESET ROLE;
RESET request.jwt.claim.sub;

-- ============================================================================
-- Test 5: Test audit log immutability
-- ============================================================================
INSERT INTO audit_logs (user_id, action, table_name, record_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'CREATE', 'cases', gen_random_uuid());

SELECT throws_ok(
  $$
    UPDATE audit_logs SET action = 'DELETE' WHERE table_name = 'cases'
  $$,
  'Audit logs are immutable',
  'Updating audit logs should fail'
);

SELECT throws_ok(
  $$
    DELETE FROM audit_logs WHERE table_name = 'cases'
  $$,
  'Audit logs are immutable',
  'Deleting audit logs should fail'
);

-- ============================================================================
-- Test 6: Verify indexes on foreign keys
-- ============================================================================
SELECT has_index(
  'confidence_violations',
  'idx_confidence_violations_prediction_id',
  'Foreign key to predictions should have index'
);

SELECT has_index(
  'organization_members',
  'idx_organization_members_user_org',
  'Composite index for RLS should exist'
);

-- ============================================================================
-- Test 7: Verify SECURITY DEFINER functions are secured
-- ============================================================================
SELECT results_eq(
  $$
    SELECT count(*)::int
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true
      AND n.nspname = 'public'
      AND (p.proconfig IS NULL OR NOT 'search_path' = ANY(p.proconfig))
  $$,
  $$
    VALUES (0)
  $$,
  'All SECURITY DEFINER functions should have search_path set'
);

-- ============================================================================
-- Test 8: Verify no overly permissive policies
-- ============================================================================
SELECT results_eq(
  $$
    SELECT count(*)::int
    FROM pg_policies
    WHERE (policyqualifiedusing LIKE '%true%' OR policyqualifiedcheck LIKE '%true%')
      AND policyname NOT LIKE '%service_role%'
      AND policyname NOT LIKE '%System%'
      AND policycommand != 'SELECT'  -- SELECT with true is ok for public data
  $$,
  $$
    VALUES (0)
  $$,
  'Non-SELECT policies should not use USING(true) outside service_role'
);

-- ============================================================================
-- Test 9: Verify webhook security
-- ============================================================================
SELECT results_eq(
  $$
    SELECT count(*)::int
    FROM pg_policies
    WHERE tablename = 'webhook_events'
      AND policyname LIKE '%service_role%'
  $$,
  $$
    VALUES (1)
  $$,
  'webhook_events should only be accessible by service_role'
);

-- ============================================================================
-- Test 10: Verify agent predictions isolation
-- ============================================================================
INSERT INTO agent_sessions (id, user_id, status)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'active'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'active');

-- Test as User 1
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SET ROLE authenticated;

SELECT results_eq(
  $$
    SELECT count(*)::int FROM agent_sessions
  $$,
  $$
    VALUES (1)
  $$,
  'User should only see their own agent sessions'
);

-- ============================================================================
-- Cleanup and Finish
-- ============================================================================
SELECT * FROM finish();

ROLLBACK;
