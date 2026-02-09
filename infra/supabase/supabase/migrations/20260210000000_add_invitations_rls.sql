-- ==========================================================================
-- Add RLS for invitations table to enforce tenant isolation
-- ==========================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invitations'
  ) THEN
    -- Ensure invitations has expected tenant_id column and enable RLS
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'tenant_id'
    ) THEN
      ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.invitations FORCE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS tenant_isolation_select ON public.invitations;
      DROP POLICY IF EXISTS tenant_isolation_insert ON public.invitations;
      DROP POLICY IF EXISTS tenant_isolation_update ON public.invitations;
      DROP POLICY IF EXISTS tenant_isolation_delete ON public.invitations;

      CREATE POLICY tenant_isolation_select ON public.invitations
        AS RESTRICTIVE
        FOR SELECT
        USING (security.user_has_tenant_access(tenant_id));

      CREATE POLICY tenant_isolation_insert ON public.invitations
        AS RESTRICTIVE
        FOR INSERT
        WITH CHECK (security.user_has_tenant_access(tenant_id));

      CREATE POLICY tenant_isolation_update ON public.invitations
        AS RESTRICTIVE
        FOR UPDATE
        USING (security.user_has_tenant_access(tenant_id))
        WITH CHECK (security.user_has_tenant_access(tenant_id));

      CREATE POLICY tenant_isolation_delete ON public.invitations
        AS RESTRICTIVE
        FOR DELETE
        USING (security.user_has_tenant_access(tenant_id));
    END IF;
  END IF;
END $$;
