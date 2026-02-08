-- ============================================================================
-- Enforce Tenant Isolation for Billing and Usage Tables
-- ============================================================================

-- Use security.current_tenant_id_uuid() defined in previous migration
-- if it doesn't exist, we fall back to a local implementation or fail if needed.

DO $$
DECLARE
  r RECORD;
  tenant_expr TEXT := 'security.current_tenant_id_uuid()';
  billing_tables TEXT[] := ARRAY[
    'billing_customers',
    'subscriptions',
    'invoices',
    'usage_aggregates',
    'usage_alerts',
    'llm_usage'
  ];
  t_name TEXT;
BEGIN
  FOREACH t_name IN ARRAY billing_tables
  LOOP
    -- Verify table exists and has tenant_id column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = t_name
      AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t_name);

      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON public.%I;', t_name);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON public.%I;', t_name);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON public.%I;', t_name);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON public.%I;', t_name);

      -- SELECT policy: Users can only see their own tenant's data
      EXECUTE format(
        'CREATE POLICY tenant_isolation_select ON public.%I FOR SELECT USING (tenant_id = %s);',
        t_name,
        tenant_expr
      );

      -- INSERT policy: Users can only insert data for their own tenant
      EXECUTE format(
        'CREATE POLICY tenant_isolation_insert ON public.%I FOR INSERT WITH CHECK (tenant_id = %s);',
        t_name,
        tenant_expr
      );

      -- UPDATE policy: Users can only update data for their own tenant
      EXECUTE format(
        'CREATE POLICY tenant_isolation_update ON public.%I FOR UPDATE USING (tenant_id = %s) WITH CHECK (tenant_id = %s);',
        t_name,
        tenant_expr,
        tenant_expr
      );

      -- DELETE policy: Users can only delete data for their own tenant
      EXECUTE format(
        'CREATE POLICY tenant_isolation_delete ON public.%I FOR DELETE USING (tenant_id = %s);',
        t_name,
        tenant_expr
      );

      RAISE NOTICE 'Applied tenant isolation policies to table: %', t_name;
    ELSE
      RAISE WARNING 'Table % not found or missing tenant_id column, skipping RLS.', t_name;
    END IF;
  END LOOP;
END $$;
