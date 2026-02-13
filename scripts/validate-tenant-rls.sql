-- Schema-governance validation for tenant scope + RLS.
-- Run with: supabase db query --file scripts/validate-tenant-rls.sql

DO $$
DECLARE
  failures int := 0;
  t text;
  has_tenant_id boolean;
  has_org_id boolean;
  has_rls boolean;
  policy_count int;

  -- Governance classification: only these tables are required to carry tenant/org columns.
  tenant_scoped_tables text[] := ARRAY[
    'users','models','agents','agent_runs','agent_memory','api_keys','kpis','cases',
    'workflows','workflow_states','shared_artifacts','audit_logs',
    'academy_progress','academy_certifications'
  ];

  -- Explicitly global Academy tables (no tenant column required).
  global_tables text[] := ARRAY['academy_modules','academy_lessons'];
BEGIN
  RAISE NOTICE 'Validating tenant-scoped tables for tenant/org column + RLS (% tables)', array_length(tenant_scoped_tables,1);

  FOREACH t IN ARRAY tenant_scoped_tables LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='tenant_id'
    ) INTO has_tenant_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='organization_id'
    ) INTO has_org_id;

    SELECT COALESCE(c.relrowsecurity, false)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname=t
    INTO has_rls;

    SELECT COUNT(*)
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname=t
    INTO policy_count;

    IF NOT (has_tenant_id OR has_org_id) THEN
      RAISE WARNING 'MISSING tenant scope column (tenant_id/organization_id) on table %', t;
      failures := failures + 1;
    ELSE
      RAISE NOTICE 'OK: % has tenant scope column', t;
    END IF;

    IF has_rls AND policy_count > 0 THEN
      RAISE NOTICE 'OK: % has RLS enabled with % policies', t, policy_count;
    ELSE
      RAISE WARNING 'MISSING/INCOMPLETE RLS on table % (enabled=%, policies=%)', t, has_rls, policy_count;
      failures := failures + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Validating global tables are exempt from tenant-column requirement (% tables)', array_length(global_tables,1);

  FOREACH t IN ARRAY global_tables LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='tenant_id'
    ) INTO has_tenant_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='organization_id'
    ) INTO has_org_id;

    IF has_tenant_id OR has_org_id THEN
      RAISE WARNING 'GLOBAL table % unexpectedly has tenant/org scope column; confirm classification', t;
      failures := failures + 1;
    ELSE
      RAISE NOTICE 'OK: global table % has no tenant/org scope column (as expected)', t;
    END IF;
  END LOOP;

  IF failures > 0 THEN
    RAISE EXCEPTION 'Schema governance validation failed with % issue(s)', failures;
  ELSE
    RAISE NOTICE 'Schema governance validation passed: tenant-scoped requirements and global-table exemptions are correct.';
  END IF;
END;
$$;
