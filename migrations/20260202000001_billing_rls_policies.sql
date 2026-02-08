-- ============================================================================
-- Enforce billing tenant isolation policies + service role access
-- ============================================================================

DO $$
DECLARE
  tenant_expr TEXT := 'security.current_tenant_id_uuid()';
  t_name TEXT;
  billing_tables TEXT[] := ARRAY['billing_customers', 'subscriptions', 'invoices'];
BEGIN
  FOREACH t_name IN ARRAY billing_tables
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t_name
        AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t_name);

      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON public.%I;', t_name);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON public.%I;', t_name);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON public.%I;', t_name);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON public.%I;', t_name);

      EXECUTE format(
        'CREATE POLICY tenant_isolation_select ON public.%I FOR SELECT USING (tenant_id = %s);',
        t_name,
        tenant_expr
      );
      EXECUTE format(
        'CREATE POLICY tenant_isolation_insert ON public.%I FOR INSERT WITH CHECK (tenant_id = %s);',
        t_name,
        tenant_expr
      );
      EXECUTE format(
        'CREATE POLICY tenant_isolation_update ON public.%I FOR UPDATE USING (tenant_id = %s) WITH CHECK (tenant_id = %s);',
        t_name,
        tenant_expr,
        tenant_expr
      );
      EXECUTE format(
        'CREATE POLICY tenant_isolation_delete ON public.%I FOR DELETE USING (tenant_id = %s);',
        t_name,
        tenant_expr
      );

      EXECUTE format('DROP POLICY IF EXISTS billing_service_role_all ON public.%I;', t_name);
      EXECUTE format(
        'CREATE POLICY billing_service_role_all ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
        t_name
      );
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.verify_billing_rls_policies()
RETURNS TABLE(
  table_name TEXT,
  rls_enabled BOOLEAN,
  tenant_policy_count INTEGER,
  service_role_policy_count INTEGER
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.relname::text AS table_name,
    c.relrowsecurity AS rls_enabled,
    COUNT(*) FILTER (
      WHERE p.policyname IN (
        'tenant_isolation_select',
        'tenant_isolation_insert',
        'tenant_isolation_update',
        'tenant_isolation_delete'
      )
      AND (
        (p.qual ILIKE '%tenant_id%' AND p.qual ILIKE '%security.current_tenant_id%')
        OR (p.with_check ILIKE '%tenant_id%' AND p.with_check ILIKE '%security.current_tenant_id%')
      )
    )::INTEGER AS tenant_policy_count,
    COUNT(*) FILTER (
      WHERE p.policyname = 'billing_service_role_all'
        AND 'service_role' = ANY (p.roles)
    )::INTEGER AS service_role_policy_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policies p
    ON p.schemaname = n.nspname
    AND p.tablename = c.relname
  WHERE n.nspname = 'public'
    AND c.relname = ANY (ARRAY['billing_customers', 'subscriptions', 'invoices'])
  GROUP BY c.relname, c.relrowsecurity
  ORDER BY c.relname;
$$;
