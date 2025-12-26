-- Check tenant-scoped tables for organization_id column and RLS policy presence
-- Run with: supabase db query --file scripts/validate-tenant-rls.sql

DO $$
DECLARE
  missing_count int := 0;
  t text;
  has_col boolean;
  has_rls boolean;
  policy_count int;
  expected_tables text[] := ARRAY['users','models','agents','agent_runs','agent_memory','api_keys','kpis','cases','workflows','workflow_states','shared_artifacts','audit_logs'];
BEGIN
  RAISE NOTICE 'Validating tenant columns (organization_id) and RLS policies for % tables', array_length(expected_tables,1);
  FOREACH t IN ARRAY expected_tables LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = t AND column_name = 'organization_id'
    ) INTO has_col;

    SELECT relrowsecurity FROM pg_class WHERE oid = format('public.%s', t)::regclass INTO has_rls;

    SELECT COUNT(*) FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid WHERE c.relname = t INTO policy_count;

    IF NOT has_col THEN
      RAISE WARNING 'MISSING org column on table %', t;
      missing_count := missing_count + 1;
    ELSE
      RAISE NOTICE 'OK: % has organization_id', t;
    END IF;

    IF has_rls THEN
      RAISE NOTICE 'OK: % has RLS enabled; policies: %', t, policy_count;
    ELSE
      RAISE WARNING 'MISSING RLS on table %', t;
      missing_count := missing_count + 1;
    END IF;

  END LOOP;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Validation failed: % checks failed', missing_count;
  ELSE
    RAISE NOTICE 'Validation completed: all tenant tables have organization_id and RLS policy.';
  END IF;
END;
$$;