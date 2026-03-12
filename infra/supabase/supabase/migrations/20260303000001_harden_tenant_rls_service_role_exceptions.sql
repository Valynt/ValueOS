-- Harden tenant RLS policies by requiring explicit service-role bypasses
-- and ensuring newly introduced tenant-facing tables have concrete policies.

BEGIN;

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

DROP POLICY IF EXISTS "Saga transitions are tenant-scoped" ON public.saga_transitions;
DROP POLICY IF EXISTS "Evidence items are tenant-scoped" ON public.evidence_items;
DROP POLICY IF EXISTS "Provenance records are tenant-scoped" ON public.provenance_records;

CREATE POLICY saga_transitions_tenant_scoped
  ON public.saga_transitions
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.cases
      WHERE cases.id = saga_transitions.value_case_id
        AND cases.organization_id = (auth.jwt() ->> 'organization_id')::uuid
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.cases
      WHERE cases.id = saga_transitions.value_case_id
        AND cases.organization_id = (auth.jwt() ->> 'organization_id')::uuid
    )
  );

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

CREATE POLICY provenance_records_tenant_scoped
  ON public.provenance_records
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.cases
      WHERE cases.id = provenance_records.value_case_id
        AND cases.organization_id = (auth.jwt() ->> 'organization_id')::uuid
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.cases
      WHERE cases.id = provenance_records.value_case_id
        AND cases.organization_id = (auth.jwt() ->> 'organization_id')::uuid
    )
  );

COMMIT;
