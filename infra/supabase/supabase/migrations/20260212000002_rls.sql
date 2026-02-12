-- ============================================================================
-- 002_rls.sql — Consolidated row-level security for ValueOS
-- Replaces 15+ overlapping RLS migrations with a single canonical pass.
-- Strategy: security.user_has_tenant_access() checks user_tenants membership
-- via auth.uid(). Service role bypasses RLS by default.
-- ============================================================================

-- ============================================================================
-- 1. Security schema and canonical tenant access helper
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS security;

-- Canonical tenant access check: verifies the authenticated user has an active
-- membership in user_tenants for the given tenant_id.
CREATE OR REPLACE FUNCTION security.current_tenant_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.tenant_id', true), ''),
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id'),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')
  );
$$;

CREATE OR REPLACE FUNCTION security.current_tenant_id_uuid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(security.current_tenant_id(), '')::uuid;
$$;

-- Backwards-compatible helper
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT security.current_tenant_id_uuid();
$$;

-- TEXT overload: primary tenant access check
CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND target_tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_tenants AS ut
      WHERE ut.user_id = (auth.uid())::text
        AND ut.tenant_id = target_tenant_id
        AND ut.status = 'active'
    );
$$;

-- UUID overload: delegates to TEXT version
CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT security.user_has_tenant_access(target_tenant_id::text);
$$;

-- Lock down access to the helper functions
REVOKE ALL ON FUNCTION security.user_has_tenant_access(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION security.user_has_tenant_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION security.user_has_tenant_access(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION security.user_has_tenant_access(UUID) TO anon, authenticated;

-- app schema helpers (used by value_commitment_tracking RLS)
CREATE OR REPLACE FUNCTION app.is_active_member(_tenant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = _tenant_id AND m.user_id = _user_id AND m.status = 'active'
  )
$$;

-- ============================================================================
-- 2. Enable RLS on ALL tenant-scoped tables
-- ============================================================================

-- Dynamic: enable RLS + FORCE on every public BASE TABLE with a tenant_id column
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('user_tenants')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', r.table_name);
  END LOOP;
END $$;

-- Tables without tenant_id that still need RLS
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'memberships', 'permissions', 'role_permissions', 'membership_roles',
    'referral_codes', 'referrals', 'referral_rewards',
    'docs_embeddings'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 3. Canonical tenant isolation policies for all tenant_id tables
-- Drop any existing policies first, then create RESTRICTIVE policies.
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'tenant_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('user_tenants')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON public.%I;', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON public.%I;', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON public.%I;', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON public.%I;', r.table_name);

    EXECUTE format(
      'CREATE POLICY tenant_isolation_select ON public.%I AS RESTRICTIVE FOR SELECT USING (security.user_has_tenant_access(tenant_id));',
      r.table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_insert ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id));',
      r.table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_update ON public.%I AS RESTRICTIVE FOR UPDATE USING (security.user_has_tenant_access(tenant_id)) WITH CHECK (security.user_has_tenant_access(tenant_id));',
      r.table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_delete ON public.%I AS RESTRICTIVE FOR DELETE USING (security.user_has_tenant_access(tenant_id));',
      r.table_name
    );
  END LOOP;
END $$;

-- ============================================================================
-- 4. user_tenants: self-scoped policies
-- ============================================================================

DROP POLICY IF EXISTS tenant_isolation_select ON public.user_tenants;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.user_tenants;
DROP POLICY IF EXISTS tenant_isolation_update ON public.user_tenants;
DROP POLICY IF EXISTS tenant_isolation_delete ON public.user_tenants;

CREATE POLICY tenant_isolation_select ON public.user_tenants
AS RESTRICTIVE FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND user_id = (auth.uid())::text
  AND tenant_id IS NOT NULL
  AND status = 'active'
);

CREATE POLICY tenant_isolation_insert ON public.user_tenants
AS RESTRICTIVE FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = (auth.uid())::text
  AND tenant_id IS NOT NULL
  AND status = 'active'
);

CREATE POLICY tenant_isolation_update ON public.user_tenants
AS RESTRICTIVE FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND user_id = (auth.uid())::text
  AND tenant_id IS NOT NULL
  AND status = 'active'
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = (auth.uid())::text
  AND tenant_id IS NOT NULL
  AND status = 'active'
);

CREATE POLICY tenant_isolation_delete ON public.user_tenants
AS RESTRICTIVE FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND user_id = (auth.uid())::text
  AND tenant_id IS NOT NULL
  AND status = 'active'
);

-- ============================================================================
-- 5. Referral tables: user-scoped (no tenant_id)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referral_codes') THEN
    DROP POLICY IF EXISTS "Users can view own referral codes" ON public.referral_codes;
    DROP POLICY IF EXISTS "Users can create own referral codes" ON public.referral_codes;
    DROP POLICY IF EXISTS "Users can update own referral codes" ON public.referral_codes;

    CREATE POLICY referral_codes_select ON public.referral_codes
      FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY referral_codes_insert ON public.referral_codes
      FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY referral_codes_update ON public.referral_codes
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referrals') THEN
    DROP POLICY IF EXISTS "Users can view involved referrals" ON public.referrals;
    DROP POLICY IF EXISTS "Users can create referrals" ON public.referrals;
    DROP POLICY IF EXISTS "Users can update involved referrals" ON public.referrals;

    CREATE POLICY referrals_select ON public.referrals
      FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referee_id);
    CREATE POLICY referrals_insert ON public.referrals
      FOR INSERT WITH CHECK (auth.uid() = referee_id);
    CREATE POLICY referrals_update ON public.referrals
      FOR UPDATE USING (auth.uid() = referrer_id OR auth.uid() = referee_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referral_rewards') THEN
    DROP POLICY IF EXISTS "Users can view own rewards" ON public.referral_rewards;
    DROP POLICY IF EXISTS "Users can create own rewards" ON public.referral_rewards;
    DROP POLICY IF EXISTS "Users can update own rewards" ON public.referral_rewards;

    CREATE POLICY referral_rewards_select ON public.referral_rewards
      FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY referral_rewards_insert ON public.referral_rewards
      FOR INSERT WITH CHECK (auth.uid() = user_id);
    CREATE POLICY referral_rewards_update ON public.referral_rewards
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- 6. Memory tenants: id-based (no tenant_id column on root table)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'memory_tenants') THEN
    ALTER TABLE public.memory_tenants ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS memory_tenants_select ON public.memory_tenants;
    DROP POLICY IF EXISTS memory_tenants_insert ON public.memory_tenants;
    DROP POLICY IF EXISTS memory_tenants_update ON public.memory_tenants;
    DROP POLICY IF EXISTS memory_tenants_delete ON public.memory_tenants;

    CREATE POLICY memory_tenants_select ON public.memory_tenants
      FOR SELECT USING (id = security.current_tenant_id_uuid());
    CREATE POLICY memory_tenants_insert ON public.memory_tenants
      FOR INSERT WITH CHECK (id = security.current_tenant_id_uuid());
    CREATE POLICY memory_tenants_update ON public.memory_tenants
      FOR UPDATE USING (id = security.current_tenant_id_uuid())
      WITH CHECK (id = security.current_tenant_id_uuid());
    CREATE POLICY memory_tenants_delete ON public.memory_tenants
      FOR DELETE USING (id = security.current_tenant_id_uuid());
  END IF;
END $$;

-- ============================================================================
-- 7. Verification function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_tenant_authorization_rls()
RETURNS TABLE(
  table_name TEXT,
  rls_enabled BOOLEAN,
  missing_tenant_isolation_policies TEXT[]
)
LANGUAGE sql
STABLE
AS $$
  WITH expected_policies AS (
    SELECT unnest(ARRAY[
      'tenant_isolation_select',
      'tenant_isolation_insert',
      'tenant_isolation_update',
      'tenant_isolation_delete'
    ]) AS policy_name
  ),
  tenant_tables AS (
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN information_schema.columns ic
      ON ic.table_schema = n.nspname
      AND ic.table_name = c.relname
      AND ic.column_name = 'tenant_id'
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  )
  SELECT
    t.table_name::TEXT,
    t.rls_enabled,
    ARRAY(
      SELECT ep.policy_name
      FROM expected_policies ep
      WHERE NOT EXISTS (
        SELECT 1 FROM pg_policies pol
        WHERE pol.schemaname = 'public'
          AND pol.tablename = t.table_name
          AND pol.policyname = ep.policy_name
      )
      ORDER BY ep.policy_name
    ) AS missing_tenant_isolation_policies
  FROM tenant_tables t
  ORDER BY t.table_name;
$$;
