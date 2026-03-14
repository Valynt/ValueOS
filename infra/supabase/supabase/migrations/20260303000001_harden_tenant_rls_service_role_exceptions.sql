-- Harden tenant RLS policies by requiring explicit service-role bypasses
-- and ensuring newly introduced tenant-facing tables have concrete policies.
-- Tables are guarded with existence checks: user_profile_directory, saga_transitions,
-- evidence_items, and provenance_records may not exist at this migration point.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profile_directory') THEN
    ALTER TABLE public.user_profile_directory ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.user_profile_directory FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS user_profile_directory_tenant_select ON public.user_profile_directory;
    DROP POLICY IF EXISTS user_profile_directory_service_role_access ON public.user_profile_directory;

    CREATE POLICY user_profile_directory_tenant_select
      ON public.user_profile_directory
      FOR SELECT
      TO authenticated
      USING (
        auth.role() = 'service_role'
        OR tenant_id = (auth.jwt() ->> 'tenant_id')
      );

    CREATE POLICY user_profile_directory_service_role_access
      ON public.user_profile_directory
      FOR ALL
      TO service_role
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saga_transitions') THEN
    DROP POLICY IF EXISTS "Saga transitions are tenant-scoped" ON public.saga_transitions;

    CREATE POLICY saga_transitions_tenant_scoped
      ON public.saga_transitions
      FOR ALL
      USING (
        auth.role() = 'service_role'
        OR EXISTS (
          SELECT 1 FROM public.cases
          WHERE cases.id = saga_transitions.value_case_id
            AND cases.organization_id = (auth.jwt() ->> 'organization_id')::uuid
        )
      )
      WITH CHECK (
        auth.role() = 'service_role'
        OR EXISTS (
          SELECT 1 FROM public.cases
          WHERE cases.id = saga_transitions.value_case_id
            AND cases.organization_id = (auth.jwt() ->> 'organization_id')::uuid
        )
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evidence_items') THEN
    DROP POLICY IF EXISTS "Evidence items are tenant-scoped" ON public.evidence_items;

    CREATE POLICY evidence_items_tenant_scoped
      ON public.evidence_items
      FOR ALL
      USING (
        auth.role() = 'service_role'
        OR organization_id = (auth.jwt() ->> 'organization_id')::uuid
      )
      WITH CHECK (
        auth.role() = 'service_role'
        OR organization_id = (auth.jwt() ->> 'organization_id')::uuid
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'provenance_records') THEN
    DROP POLICY IF EXISTS "Provenance records are tenant-scoped" ON public.provenance_records;

    CREATE POLICY provenance_records_tenant_scoped
      ON public.provenance_records
      FOR ALL
      USING (
        auth.role() = 'service_role'
        OR EXISTS (
          SELECT 1 FROM public.cases
          WHERE cases.id = provenance_records.value_case_id
            AND cases.organization_id = (auth.jwt() ->> 'organization_id')::uuid
        )
      )
      WITH CHECK (
        auth.role() = 'service_role'
        OR EXISTS (
          SELECT 1 FROM public.cases
          WHERE cases.id = provenance_records.value_case_id
            AND cases.organization_id = (auth.jwt() ->> 'organization_id')::uuid
        )
      );
  END IF;
END $$;

COMMIT;
