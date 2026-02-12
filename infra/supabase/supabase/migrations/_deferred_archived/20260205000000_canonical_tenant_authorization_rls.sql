-- ============================================================================
-- Canonical tenant authorization helper + global tenant RLS policy refresh
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS security;

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

CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT security.user_has_tenant_access(target_tenant_id::text);
$$;

REVOKE ALL ON FUNCTION security.user_has_tenant_access(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION security.user_has_tenant_access(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION security.user_has_tenant_access(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION security.user_has_tenant_access(UUID) TO anon, authenticated;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'tenant_id'
      AND table_name <> 'user_tenants'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;', r.table_schema, r.table_name);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY;', r.table_schema, r.table_name);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON %I.%I;', r.table_schema, r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON %I.%I;', r.table_schema, r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON %I.%I;', r.table_schema, r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON %I.%I;', r.table_schema, r.table_name);

    EXECUTE format(
      'CREATE POLICY tenant_isolation_select ON %I.%I AS RESTRICTIVE FOR SELECT USING (security.user_has_tenant_access(tenant_id));',
      r.table_schema,
      r.table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_insert ON %I.%I AS RESTRICTIVE FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id));',
      r.table_schema,
      r.table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_update ON %I.%I AS RESTRICTIVE FOR UPDATE USING (security.user_has_tenant_access(tenant_id)) WITH CHECK (security.user_has_tenant_access(tenant_id));',
      r.table_schema,
      r.table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_delete ON %I.%I AS RESTRICTIVE FOR DELETE USING (security.user_has_tenant_access(tenant_id));',
      r.table_schema,
      r.table_name
    );
  END LOOP;
END $$;

ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_select ON public.user_tenants;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.user_tenants;
DROP POLICY IF EXISTS tenant_isolation_update ON public.user_tenants;
DROP POLICY IF EXISTS tenant_isolation_delete ON public.user_tenants;

CREATE POLICY tenant_isolation_select ON public.user_tenants
AS RESTRICTIVE
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND user_id = (auth.uid())::text
  AND tenant_id IS NOT NULL
  AND status = 'active'
);

CREATE POLICY tenant_isolation_insert ON public.user_tenants
AS RESTRICTIVE
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = (auth.uid())::text
  AND tenant_id IS NOT NULL
  AND status = 'active'
);

CREATE POLICY tenant_isolation_update ON public.user_tenants
AS RESTRICTIVE
FOR UPDATE
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
AS RESTRICTIVE
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND user_id = (auth.uid())::text
  AND tenant_id IS NOT NULL
  AND status = 'active'
);

CREATE OR REPLACE FUNCTION public.verify_tenant_authorization_rls()
RETURNS TABLE(
  table_name TEXT,
  rls_enabled BOOLEAN,
  missing_tenant_isolation_policies TEXT[],
  helper_text_is_security_definer BOOLEAN,
  helper_text_has_safe_search_path BOOLEAN,
  helper_uuid_is_security_definer BOOLEAN,
  helper_uuid_has_safe_search_path BOOLEAN
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
  ),
  helper_status AS (
    SELECT
      BOOL_OR(
        pg_get_function_identity_arguments(p.oid) = 'target_tenant_id text'
        AND p.prosecdef
      ) AS helper_text_is_security_definer,
      BOOL_OR(
        pg_get_function_identity_arguments(p.oid) = 'target_tenant_id text'
        AND EXISTS (
          SELECT 1
          FROM unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) cfg
          WHERE cfg = 'search_path=public, pg_catalog'
        )
      ) AS helper_text_has_safe_search_path,
      BOOL_OR(
        pg_get_function_identity_arguments(p.oid) = 'target_tenant_id uuid'
        AND p.prosecdef
      ) AS helper_uuid_is_security_definer,
      BOOL_OR(
        pg_get_function_identity_arguments(p.oid) = 'target_tenant_id uuid'
        AND EXISTS (
          SELECT 1
          FROM unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) cfg
          WHERE cfg = 'search_path=public, pg_catalog'
        )
      ) AS helper_uuid_has_safe_search_path
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'security'
      AND p.proname = 'user_has_tenant_access'
  )
  SELECT
    t.table_name::TEXT,
    t.rls_enabled,
    ARRAY(
      SELECT ep.policy_name
      FROM expected_policies ep
      WHERE NOT EXISTS (
        SELECT 1
        FROM pg_policies pol
        WHERE pol.schemaname = 'public'
          AND pol.tablename = t.table_name
          AND pol.policyname = ep.policy_name
      )
      ORDER BY ep.policy_name
    ) AS missing_tenant_isolation_policies,
    hs.helper_text_is_security_definer,
    hs.helper_text_has_safe_search_path,
    hs.helper_uuid_is_security_definer,
    hs.helper_uuid_has_safe_search_path
  FROM tenant_tables t
  CROSS JOIN helper_status hs
  ORDER BY t.table_name;
$$;
