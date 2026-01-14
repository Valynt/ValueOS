-- Settings RLS Cross-Tenant Access Tests
-- Phase 2 Task 1: RLS Policy Validation
-- 
-- Tests that users from Tenant A cannot access settings from Tenant B
-- Ensures strict tenant isolation for all settings tables

BEGIN;

-- Create test plan
SELECT plan(12);

-- ============================================================================
-- Setup Test Data
-- ============================================================================

-- Create test tenants
INSERT INTO organizations (id, name, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Tenant A', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'Tenant B', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create test users
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, 'user-a@tenant-a.com', crypt('password', gen_salt('bf')), NOW(), NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000001'::uuid, 'user-b@tenant-b.com', crypt('password', gen_salt('bf')), NOW(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Link users to tenants
INSERT INTO user_tenants (user_id, tenant_id, role, status, created_at, updated_at)
VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'admin', 'active', NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000002'::uuid, 'admin', 'active', NOW(), NOW())
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Create organization configurations for both tenants
INSERT INTO organization_configurations (organization_id, auth_policy, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, 
   '{"enforceMFA": true, "passwordPolicy": {"minLength": 12}}'::jsonb,
   NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002'::uuid,
   '{"enforceMFA": false, "passwordPolicy": {"minLength": 8}}'::jsonb,
   NOW(), NOW())
ON CONFLICT (organization_id) DO NOTHING;

-- ============================================================================
-- Test 1: User A can access Tenant A's organization configurations
-- ============================================================================

SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO json_build_object(
  'sub', '10000000-0000-0000-0000-000000000001',
  'role', 'authenticated'
)::text;

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM organization_configurations
    WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  $$,
  $$VALUES (1)$$,
  'User A can access Tenant A organization configurations'
);

-- ============================================================================
-- Test 2: User A CANNOT access Tenant B's organization configurations
-- ============================================================================

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM organization_configurations
    WHERE organization_id = '00000000-0000-0000-0000-000000000002'::uuid
  $$,
  $$VALUES (0)$$,
  'User A CANNOT access Tenant B organization configurations (RLS blocks)'
);

-- ============================================================================
-- Test 3: User B can access Tenant B's organization configurations
-- ============================================================================

SET LOCAL request.jwt.claims TO json_build_object(
  'sub', '20000000-0000-0000-0000-000000000001',
  'role', 'authenticated'
)::text;

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM organization_configurations
    WHERE organization_id = '00000000-0000-0000-0000-000000000002'::uuid
  $$,
  $$VALUES (1)$$,
  'User B can access Tenant B organization configurations'
);

-- ============================================================================
-- Test 4: User B CANNOT access Tenant A's organization configurations
-- ============================================================================

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM organization_configurations
    WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  $$,
  $$VALUES (0)$$,
  'User B CANNOT access Tenant A organization configurations (RLS blocks)'
);

-- ============================================================================
-- Test 5: User A can UPDATE Tenant A's configurations
-- ============================================================================

SET LOCAL request.jwt.claims TO json_build_object(
  'sub', '10000000-0000-0000-0000-000000000001',
  'role', 'authenticated'
)::text;

UPDATE organization_configurations
SET auth_policy = '{"enforceMFA": false}'::jsonb
WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid;

SELECT results_eq(
  $$
    SELECT (auth_policy->>'enforceMFA')::boolean
    FROM organization_configurations
    WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  $$,
  $$VALUES (false)$$,
  'User A can UPDATE Tenant A configurations'
);

-- ============================================================================
-- Test 6: User A CANNOT UPDATE Tenant B's configurations
-- ============================================================================

-- This should affect 0 rows due to RLS
UPDATE organization_configurations
SET auth_policy = '{"enforceMFA": true}'::jsonb
WHERE organization_id = '00000000-0000-0000-0000-000000000002'::uuid;

SELECT results_eq(
  $$
    SELECT (auth_policy->>'enforceMFA')::boolean
    FROM organization_configurations
    WHERE organization_id = '00000000-0000-0000-0000-000000000002'::uuid
  $$,
  $$VALUES (false)$$,
  'User A CANNOT UPDATE Tenant B configurations (RLS blocks, value unchanged)'
);

-- ============================================================================
-- Test 7: User preferences isolation (auth.users table)
-- ============================================================================

-- Add user preferences for both users
UPDATE auth.users
SET user_preferences = '{"theme": "dark"}'::jsonb
WHERE id = '10000000-0000-0000-0000-000000000001'::uuid;

UPDATE auth.users
SET user_preferences = '{"theme": "light"}'::jsonb
WHERE id = '20000000-0000-0000-0000-000000000001'::uuid;

-- User A can only see their own preferences
SET LOCAL request.jwt.claims TO json_build_object(
  'sub', '10000000-0000-0000-0000-000000000001',
  'role', 'authenticated'
)::text;

SELECT results_eq(
  $$
    SELECT (user_preferences->>'theme')::text
    FROM auth.users
    WHERE id = '10000000-0000-0000-0000-000000000001'::uuid
  $$,
  $$VALUES ('dark')$$,
  'User A can access their own user preferences'
);

-- ============================================================================
-- Test 8: User A CANNOT access User B's preferences
-- ============================================================================

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM auth.users
    WHERE id = '20000000-0000-0000-0000-000000000001'::uuid
  $$,
  $$VALUES (0)$$,
  'User A CANNOT access User B preferences (RLS blocks)'
);

-- ============================================================================
-- Test 9: Team settings isolation
-- ============================================================================

-- Create teams for both tenants
INSERT INTO teams (id, name, organization_id, team_settings, created_at, updated_at)
VALUES
  ('30000000-0000-0000-0000-000000000001'::uuid, 'Team A', '00000000-0000-0000-0000-000000000001'::uuid, 
   '{"defaultRole": "member"}'::jsonb, NOW(), NOW()),
  ('40000000-0000-0000-0000-000000000001'::uuid, 'Team B', '00000000-0000-0000-0000-000000000002'::uuid,
   '{"defaultRole": "admin"}'::jsonb, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- User A can access Team A
SET LOCAL request.jwt.claims TO json_build_object(
  'sub', '10000000-0000-0000-0000-000000000001',
  'role', 'authenticated'
)::text;

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM teams
    WHERE id = '30000000-0000-0000-0000-000000000001'::uuid
  $$,
  $$VALUES (1)$$,
  'User A can access Team A settings'
);

-- ============================================================================
-- Test 10: User A CANNOT access Team B
-- ============================================================================

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM teams
    WHERE id = '40000000-0000-0000-0000-000000000001'::uuid
  $$,
  $$VALUES (0)$$,
  'User A CANNOT access Team B settings (RLS blocks)'
);

-- ============================================================================
-- Test 11: Service role can access all configurations
-- ============================================================================

RESET role;
SET LOCAL role TO service_role;

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM organization_configurations
    WHERE organization_id IN (
      '00000000-0000-0000-0000-000000000001'::uuid,
      '00000000-0000-0000-0000-000000000002'::uuid
    )
  $$,
  $$VALUES (2)$$,
  'Service role can access all organization configurations'
);

-- ============================================================================
-- Test 12: Verify RLS is enabled on all settings tables
-- ============================================================================

SELECT results_eq(
  $$
    SELECT COUNT(*)::int
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('organization_configurations', 'teams')
    AND rowsecurity = true
  $$,
  $$VALUES (2)$$,
  'RLS is enabled on all settings tables'
);

-- ============================================================================
-- Cleanup
-- ============================================================================

ROLLBACK;

SELECT * FROM finish();
