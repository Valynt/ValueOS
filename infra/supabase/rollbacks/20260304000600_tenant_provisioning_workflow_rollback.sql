-- Rollback: 20260304000600_tenant_provisioning_workflow
DO $$
BEGIN
  -- Drop all variants of tenant_provisioning_workflow in the public schema,
  -- regardless of their parameter signatures, to match the migration.
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'tenant_provisioning_workflow'
  ) THEN
    EXECUTE (
      SELECT string_agg(
        format(
          'DROP FUNCTION IF EXISTS public.%I(%s);',
          p.proname,
          pg_get_function_identity_arguments(p.oid)
        ),
        E'\n'
      )
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'tenant_provisioning_workflow'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP INDEX IF EXISTS public.idx_entitlement_snapshots_one_current_per_tenant;
DROP TABLE IF EXISTS public.tenant_provisioning_requests CASCADE;
