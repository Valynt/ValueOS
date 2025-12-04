-- ============================================================================
-- Multi-tenant RLS regression suite
-- Verifies tenant/user isolation on core tables and service-role bypass rules.
-- ============================================================================

BEGIN;

SELECT plan(4);

-- Test 1: Cases stay isolated per authenticated user
INSERT INTO users (id, email, full_name)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'tenant1@example.com', 'Tenant 1 User'),
  ('20000000-0000-0000-0000-000000000002', 'tenant2@example.com', 'Tenant 2 User')
ON CONFLICT DO NOTHING;

INSERT INTO cases (id, user_id, organization_id, title, status)
VALUES
  ('c1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Tenant 1 Case', 'active'),
  ('c2000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Tenant 2 Case', 'active')
ON CONFLICT DO NOTHING;

SET request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
SET ROLE authenticated;

SELECT results_eq(
  $$
    SELECT count(*)::int FROM cases
  $$,
  $$
    VALUES (1)
  $$,
  'Authenticated users should only see their cases'
);

RESET ROLE;
RESET request.jwt.claim.sub;

-- Test 2: Cross-tenant insert fails
SET request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
SET ROLE authenticated;

SELECT throws_ok(
  $$
    INSERT INTO cases (user_id, organization_id, title, status)
    VALUES ('20000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Bad insert', 'active')
  $$,
  '.*row-level security.*',
  'RLS should block writing data for another user/tenant'
);

RESET ROLE;
RESET request.jwt.claim.sub;

-- Test 3: Agent sessions remain scoped
INSERT INTO agent_sessions (id, user_id, status)
VALUES
  ('a1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'active'),
  ('a2000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'active')
ON CONFLICT DO NOTHING;

SET request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';
SET ROLE authenticated;

SELECT results_eq(
  $$
    SELECT count(*)::int FROM agent_sessions
  $$,
  $$
    VALUES (1)
  $$,
  'Agent sessions remain tenant/user isolated'
);

RESET ROLE;
RESET request.jwt.claim.sub;

-- Test 4: Service role bypass confirmed
SET ROLE service_role;

SELECT results_eq(
  $$
    SELECT count(*)::int FROM cases WHERE user_id IN ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002')
  $$,
  $$
    VALUES (2)
  $$,
  'Service role should bypass tenant isolation policies'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
