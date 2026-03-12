-- Rollback: restore prior non-remediated policy shapes.

BEGIN;

-- --------------------------------------------------------------------------
-- usage_ledger
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS usage_ledger_tenant_select ON public.usage_ledger;
DROP POLICY IF EXISTS usage_ledger_tenant_insert ON public.usage_ledger;
DROP POLICY IF EXISTS usage_ledger_tenant_update ON public.usage_ledger;
DROP POLICY IF EXISTS usage_ledger_tenant_delete ON public.usage_ledger;
DROP POLICY IF EXISTS usage_ledger_service_role ON public.usage_ledger;
DROP POLICY IF EXISTS usage_ledger_tenant_isolation ON public.usage_ledger;

CREATE POLICY usage_ledger_tenant_isolation ON public.usage_ledger
  FOR ALL
  TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- --------------------------------------------------------------------------
-- rated_ledger
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS rated_ledger_tenant_read ON public.rated_ledger;
DROP POLICY IF EXISTS rated_ledger_tenant_select ON public.rated_ledger;
DROP POLICY IF EXISTS rated_ledger_tenant_insert ON public.rated_ledger;
DROP POLICY IF EXISTS rated_ledger_tenant_update ON public.rated_ledger;
DROP POLICY IF EXISTS rated_ledger_tenant_delete ON public.rated_ledger;
DROP POLICY IF EXISTS rated_ledger_service_role ON public.rated_ledger;

CREATE POLICY rated_ledger_tenant_select ON public.rated_ledger
  FOR SELECT
  TO authenticated
  USING (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY rated_ledger_service_role ON public.rated_ledger
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- --------------------------------------------------------------------------
-- user_profile_directory
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS user_profile_directory_tenant_select ON public.user_profile_directory;
DROP POLICY IF EXISTS user_profile_directory_service_role ON public.user_profile_directory;
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

-- --------------------------------------------------------------------------
-- evidence_items
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS evidence_items_tenant_scoped ON public.evidence_items;
DROP POLICY IF EXISTS "Evidence items are tenant-scoped" ON public.evidence_items;
DROP POLICY IF EXISTS evidence_items_service_role ON public.evidence_items;

CREATE POLICY evidence_items_tenant_scoped
  ON public.evidence_items
  FOR ALL
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR organization_id = (auth.jwt() ->> 'organization_id')::uuid
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR organization_id = (auth.jwt() ->> 'organization_id')::uuid
  );

-- --------------------------------------------------------------------------
-- provenance_records
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS provenance_records_tenant_scoped ON public.provenance_records;
DROP POLICY IF EXISTS "Provenance records are tenant-scoped" ON public.provenance_records;
DROP POLICY IF EXISTS provenance_records_service_role ON public.provenance_records;

CREATE POLICY provenance_records_tenant_scoped
  ON public.provenance_records
  FOR ALL
  TO authenticated
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

-- --------------------------------------------------------------------------
-- saga_transitions
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS saga_transitions_tenant_scoped ON public.saga_transitions;
DROP POLICY IF EXISTS "Saga transitions are tenant-scoped" ON public.saga_transitions;
DROP POLICY IF EXISTS saga_transitions_select ON public.saga_transitions;
DROP POLICY IF EXISTS saga_transitions_insert ON public.saga_transitions;
DROP POLICY IF EXISTS saga_transitions_update ON public.saga_transitions;
DROP POLICY IF EXISTS saga_transitions_delete ON public.saga_transitions;
DROP POLICY IF EXISTS saga_transitions_service_role ON public.saga_transitions;

CREATE POLICY saga_transitions_select ON public.saga_transitions
  FOR SELECT
  TO authenticated
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY saga_transitions_insert ON public.saga_transitions
  FOR INSERT
  TO authenticated
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

COMMIT;

-- Verification query for rollback state inspection.
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'usage_ledger',
    'rated_ledger',
    'user_profile_directory',
    'evidence_items',
    'provenance_records',
    'saga_transitions'
  )
ORDER BY tablename, policyname;
