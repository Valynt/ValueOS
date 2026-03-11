-- tests/database/rbac_critical_fixes.test.sql
--
-- Fix 1: user_tenants → memberships sync trigger
-- Fix 2: compliance_control_* RLS uses security.user_has_tenant_access()

BEGIN;
SELECT plan(10);

-- ============================================================================
-- Fixtures
-- ============================================================================

SET LOCAL role TO service_role;

-- Tenants
INSERT INTO public.tenants (id, name, status)
VALUES
  ('fix-tenant-1', 'Fix Test Tenant 1', 'active'),
  ('fix-tenant-2', 'Fix Test Tenant 2', 'active')
ON CONFLICT (id) DO NOTHING;

-- Users
INSERT INTO public.users (id, email)
VALUES
  ('fix-user-1', 'fix1@example.com'),
  ('fix-user-2', 'fix2@example.com')
ON CONFLICT (id) DO NOTHING;

-- user_tenants (active)
INSERT INTO public.user_tenants (tenant_id, user_id, role, status)
VALUES
  ('fix-tenant-1', 'fix-user-1', 'admin', 'active'),
  ('fix-tenant-2', 'fix-user-2', 'member', 'active')
ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'active';

-- memberships (must exist for trigger to update)
INSERT INTO public.memberships (tenant_id, user_id, status, is_owner)
VALUES
  ('fix-tenant-1', 'fix-user-1'::uuid, 'active', true),
  ('fix-tenant-2', 'fix-user-2'::uuid, 'active', false)
ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'active';

-- compliance_control_status rows for RLS tests
INSERT INTO public.compliance_control_status (id, tenant_id, control_id, status, evidence_ts)
VALUES
  (gen_random_uuid(), 'fix-tenant-1'::uuid, 'ctrl-1', 'compliant', now()),
  (gen_random_uuid(), 'fix-tenant-2'::uuid, 'ctrl-2', 'compliant', now())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Fix 1: Trigger syncs memberships.status on user_tenants UPDATE
-- ============================================================================

-- 1a. Setting user_tenants.status = 'inactive' disables the memberships row.
UPDATE public.user_tenants
SET status = 'inactive'
WHERE tenant_id = 'fix-tenant-1' AND user_id = 'fix-user-1';

SELECT is(
  (SELECT status FROM public.memberships
   WHERE tenant_id = 'fix-tenant-1' AND user_id = 'fix-user-1'::uuid),
  'disabled',
  'Fix 1a: memberships.status set to disabled when user_tenants.status = inactive'
);

-- 1b. Re-activating user_tenants re-enables the memberships row.
UPDATE public.user_tenants
SET status = 'active'
WHERE tenant_id = 'fix-tenant-1' AND user_id = 'fix-user-1';

SELECT is(
  (SELECT status FROM public.memberships
   WHERE tenant_id = 'fix-tenant-1' AND user_id = 'fix-user-1'::uuid),
  'active',
  'Fix 1b: memberships.status restored to active on user_tenants reactivation'
);

-- 1c. Deleting a user_tenants row disables the memberships row.
DELETE FROM public.user_tenants
WHERE tenant_id = 'fix-tenant-2' AND user_id = 'fix-user-2';

SELECT is(
  (SELECT status FROM public.memberships
   WHERE tenant_id = 'fix-tenant-2' AND user_id = 'fix-user-2'::uuid),
  'disabled',
  'Fix 1c: memberships.status set to disabled when user_tenants row is deleted'
);

-- 1d. Trigger function exists and is SECURITY DEFINER.
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'sync_user_tenants_to_memberships'
      AND p.prosecdef = true
  ),
  'Fix 1d: sync_user_tenants_to_memberships function exists and is SECURITY DEFINER'
);

-- 1e. Trigger is attached to user_tenants.
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'user_tenants'
      AND t.tgname = 'trg_sync_user_tenants_to_memberships'
  ),
  'Fix 1e: trg_sync_user_tenants_to_memberships trigger exists on user_tenants'
);

-- ============================================================================
-- Fix 2: compliance_control_* RLS uses security.user_has_tenant_access()
-- ============================================================================

-- 2a. compliance_control_status SELECT policy uses user_has_tenant_access.
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'compliance_control_status'
      AND policyname = 'compliance_control_status_tenant_select'
      AND qual ILIKE '%user_has_tenant_access%'
  ),
  'Fix 2a: compliance_control_status SELECT policy uses user_has_tenant_access'
);

-- 2b. compliance_control_status INSERT policy uses user_has_tenant_access.
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'compliance_control_status'
      AND policyname = 'compliance_control_status_tenant_insert'
      AND with_check ILIKE '%user_has_tenant_access%'
  ),
  'Fix 2b: compliance_control_status INSERT policy uses user_has_tenant_access'
);

-- 2c. compliance_control_evidence SELECT policy uses user_has_tenant_access.
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'compliance_control_evidence'
      AND policyname = 'compliance_control_evidence_tenant_select'
      AND qual ILIKE '%user_has_tenant_access%'
  ),
  'Fix 2c: compliance_control_evidence SELECT policy uses user_has_tenant_access'
);

-- 2d. compliance_control_audit SELECT policy uses user_has_tenant_access.
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'compliance_control_audit'
      AND policyname = 'compliance_control_audit_tenant_select'
      AND qual ILIKE '%user_has_tenant_access%'
  ),
  'Fix 2d: compliance_control_audit SELECT policy uses user_has_tenant_access'
);

-- 2e. No compliance_control_* policy references the deprecated current_setting pattern.
SELECT is(
  (
    SELECT count(*)::int FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename LIKE 'compliance_control_%'
      AND (qual ILIKE '%current_setting%' OR with_check ILIKE '%current_setting%')
  ),
  0,
  'Fix 2e: no compliance_control_* policy uses deprecated current_setting pattern'
);

SELECT * FROM finish();
ROLLBACK;
