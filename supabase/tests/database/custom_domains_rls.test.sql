-- ============================================================================
-- Custom Domains RLS Policy Tests
-- ============================================================================
-- Tests Row Level Security policies for custom_domains and domain_verification_logs
-- ============================================================================

BEGIN;

-- Load pgtap extension
CREATE EXTENSION IF NOT EXISTS pgtap;

-- ============================================================================
-- Test Setup
-- ============================================================================

-- Create test organizations
INSERT INTO organizations (id, name, slug) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Test Org 1', 'test-org-1'),
    ('22222222-2222-2222-2222-222222222222', 'Test Org 2', 'test-org-2');

-- Create test users
INSERT INTO auth.users (id, email) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user1@test.com'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'user2@test.com');

-- Create organization memberships
INSERT INTO organization_members (organization_id, user_id, role) VALUES
    ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner'),
    ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner');

-- Create test custom domains
INSERT INTO custom_domains (id, tenant_id, domain, verification_token, verification_method) VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'app.test1.com', 'token1234567890abcdef1234567890ab', 'dns'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'app.test2.com', 'token0987654321fedcba0987654321fe', 'dns');

-- ============================================================================
-- Test: Table Exists
-- ============================================================================

SELECT plan(20);

SELECT has_table('custom_domains', 'custom_domains table should exist');
SELECT has_table('domain_verification_logs', 'domain_verification_logs table should exist');

-- ============================================================================
-- Test: RLS is Enabled
-- ============================================================================

SELECT is(
    (SELECT relrowsecurity FROM pg_class WHERE relname = 'custom_domains'),
    true,
    'RLS should be enabled on custom_domains'
);

SELECT is(
    (SELECT relrowsecurity FROM pg_class WHERE relname = 'domain_verification_logs'),
    true,
    'RLS should be enabled on domain_verification_logs'
);

-- ============================================================================
-- Test: Tenant Isolation - SELECT
-- ============================================================================

-- Set session as user1 (belongs to org 1)
SET LOCAL role authenticated;
SET LOCAL request.jwt.claim.sub TO 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SELECT is(
    (SELECT COUNT(*)::int FROM custom_domains),
    1,
    'User 1 should only see their own organization domains'
);

SELECT is(
    (SELECT domain FROM custom_domains LIMIT 1),
    'app.test1.com',
    'User 1 should see app.test1.com'
);

-- Set session as user2 (belongs to org 2)
SET LOCAL request.jwt.claim.sub TO 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

SELECT is(
    (SELECT COUNT(*)::int FROM custom_domains),
    1,
    'User 2 should only see their own organization domains'
);

SELECT is(
    (SELECT domain FROM custom_domains LIMIT 1),
    'app.test2.com',
    'User 2 should see app.test2.com'
);

-- ============================================================================
-- Test: Tenant Isolation - INSERT
-- ============================================================================

-- User 1 can insert domain for their org
SET LOCAL request.jwt.claim.sub TO 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SELECT lives_ok(
    $$INSERT INTO custom_domains (tenant_id, domain, verification_token, verification_method)
      VALUES ('11111111-1111-1111-1111-111111111111', 'app2.test1.com', 'token1234567890abcdef1234567890ab', 'dns')$$,
    'User 1 should be able to insert domain for their org'
);

-- User 1 cannot insert domain for another org
SELECT throws_ok(
    $$INSERT INTO custom_domains (tenant_id, domain, verification_token, verification_method)
      VALUES ('22222222-2222-2222-2222-222222222222', 'app3.test2.com', 'token0987654321fedcba0987654321fe', 'dns')$$,
    'User 1 should not be able to insert domain for another org'
);

-- ============================================================================
-- Test: Tenant Isolation - UPDATE
-- ============================================================================

-- User 1 can update their own domain
SELECT lives_ok(
    $$UPDATE custom_domains SET verified = true
      WHERE domain = 'app.test1.com'$$,
    'User 1 should be able to update their own domain'
);

-- User 1 cannot update another org's domain
SET LOCAL request.jwt.claim.sub TO 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

SELECT is(
    (SELECT COUNT(*)::int FROM custom_domains WHERE domain = 'app.test2.com'),
    0,
    'User 1 should not see app.test2.com to update it'
);

-- ============================================================================
-- Test: Tenant Isolation - DELETE
-- ============================================================================

-- User 2 can delete their own domain
SET LOCAL request.jwt.claim.sub TO 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

SELECT lives_ok(
    $$DELETE FROM custom_domains WHERE domain = 'app.test2.com'$$,
    'User 2 should be able to delete their own domain'
);

-- Verify deletion
SELECT is(
    (SELECT COUNT(*)::int FROM custom_domains WHERE domain = 'app.test2.com'),
    0,
    'Domain should be deleted'
);

-- ============================================================================
-- Test: Service Role Access
-- ============================================================================

-- Service role can access all domains
SET LOCAL role service_role;

SELECT is(
    (SELECT COUNT(*)::int FROM custom_domains),
    2,
    'Service role should see all domains'
);

-- ============================================================================
-- Test: Domain Format Validation
-- ============================================================================

-- Invalid domain format should be rejected
SELECT throws_ok(
    $$INSERT INTO custom_domains (tenant_id, domain, verification_token, verification_method)
      VALUES ('11111111-1111-1111-1111-111111111111', 'invalid domain', 'token1234567890abcdef1234567890ab', 'dns')$$,
    'Invalid domain format should be rejected'
);

-- ============================================================================
-- Test: Verification Token Length
-- ============================================================================

-- Short verification token should be rejected
SELECT throws_ok(
    $$INSERT INTO custom_domains (tenant_id, domain, verification_token, verification_method)
      VALUES ('11111111-1111-1111-1111-111111111111', 'app3.test1.com', 'short', 'dns')$$,
    'Short verification token should be rejected'
);

-- ============================================================================
-- Test: SSL Status Enum
-- ============================================================================

-- Invalid SSL status should be rejected
SELECT throws_ok(
    $$INSERT INTO custom_domains (tenant_id, domain, verification_token, verification_method, ssl_status)
      VALUES ('11111111-1111-1111-1111-111111111111', 'app4.test1.com', 'token1234567890abcdef1234567890ab', 'dns', 'invalid')$$,
    'Invalid SSL status should be rejected'
);

-- ============================================================================
-- Test: Verification Method Enum
-- ============================================================================

-- Invalid verification method should be rejected
SELECT throws_ok(
    $$INSERT INTO custom_domains (tenant_id, domain, verification_token, verification_method)
      VALUES ('11111111-1111-1111-1111-111111111111', 'app5.test1.com', 'token1234567890abcdef1234567890ab', 'invalid')$$,
    'Invalid verification method should be rejected'
);

-- ============================================================================
-- Cleanup
-- ============================================================================

SELECT * FROM finish();

ROLLBACK;
