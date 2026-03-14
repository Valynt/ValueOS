-- ============================================================================
-- Remediation: replace claim-only tenant policies with membership-backed RLS
-- Scope: usage_ledger, rated_ledger, user_profile_directory,
--        evidence_items, provenance_records, saga_transitions
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1) usage_ledger: replace claim-only policy with restrictive membership checks
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS usage_ledger_tenant_isolation ON public.usage_ledger;
DROP POLICY IF EXISTS usage_ledger_tenant_select ON public.usage_ledger;
DROP POLICY IF EXISTS usage_ledger_tenant_insert ON public.usage_ledger;
DROP POLICY IF EXISTS usage_ledger_tenant_update ON public.usage_ledger;
DROP POLICY IF EXISTS usage_ledger_tenant_delete ON public.usage_ledger;
DROP POLICY IF EXISTS usage_ledger_service_role ON public.usage_ledger;

CREATE POLICY usage_ledger_tenant_select ON public.usage_ledger
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY usage_ledger_tenant_insert ON public.usage_ledger
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY usage_ledger_tenant_update ON public.usage_ledger
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (security.user_has_tenant_access(tenant_id::text))
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY usage_ledger_tenant_delete ON public.usage_ledger
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY usage_ledger_service_role ON public.usage_ledger
  AS RESTRICTIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 2) rated_ledger: enforce restrictive select + write path membership checks
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS rated_ledger_tenant_read ON public.rated_ledger;
DROP POLICY IF EXISTS rated_ledger_tenant_select ON public.rated_ledger;
DROP POLICY IF EXISTS rated_ledger_tenant_insert ON public.rated_ledger;
DROP POLICY IF EXISTS rated_ledger_tenant_update ON public.rated_ledger;
DROP POLICY IF EXISTS rated_ledger_tenant_delete ON public.rated_ledger;
DROP POLICY IF EXISTS rated_ledger_service_role ON public.rated_ledger;

CREATE POLICY rated_ledger_tenant_select ON public.rated_ledger
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY rated_ledger_tenant_insert ON public.rated_ledger
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY rated_ledger_tenant_update ON public.rated_ledger
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (security.user_has_tenant_access(tenant_id::text))
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY rated_ledger_tenant_delete ON public.rated_ledger
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (security.user_has_tenant_access(tenant_id::text));

CREATE POLICY rated_ledger_service_role ON public.rated_ledger
  AS RESTRICTIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 3) user_profile_directory: remove claim checks/service_role branch
-- Guarded: table may not exist in all environments.
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profile_directory') THEN
    DROP POLICY IF EXISTS user_profile_directory_tenant_select ON public.user_profile_directory;
    DROP POLICY IF EXISTS user_profile_directory_service_role_access ON public.user_profile_directory;
    DROP POLICY IF EXISTS user_profile_directory_service_role ON public.user_profile_directory;

    CREATE POLICY user_profile_directory_tenant_select ON public.user_profile_directory
      AS RESTRICTIVE FOR SELECT TO authenticated
      USING (security.user_has_tenant_access(tenant_id::text));

    CREATE POLICY user_profile_directory_service_role ON public.user_profile_directory
      AS RESTRICTIVE FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- 4) evidence_items: replace direct org-claim checks
-- Guarded: table may not exist in all environments.
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evidence_items') THEN
    DROP POLICY IF EXISTS evidence_items_tenant_scoped ON public.evidence_items;
    DROP POLICY IF EXISTS "Evidence items are tenant-scoped" ON public.evidence_items;
    DROP POLICY IF EXISTS evidence_items_service_role ON public.evidence_items;

    CREATE POLICY evidence_items_tenant_scoped ON public.evidence_items
      AS RESTRICTIVE FOR ALL TO authenticated
      USING (security.user_has_tenant_access(organization_id::text))
      WITH CHECK (security.user_has_tenant_access(organization_id::text));

    CREATE POLICY evidence_items_service_role ON public.evidence_items
      AS RESTRICTIVE FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- 5) provenance_records: replace direct org-claim checks with membership join
-- Guarded: table may not exist in all environments.
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'provenance_records') THEN
    DROP POLICY IF EXISTS provenance_records_tenant_scoped ON public.provenance_records;
    DROP POLICY IF EXISTS "Provenance records are tenant-scoped" ON public.provenance_records;
    DROP POLICY IF EXISTS provenance_records_service_role ON public.provenance_records;

    CREATE POLICY provenance_records_tenant_scoped ON public.provenance_records
      AS RESTRICTIVE FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.cases
          WHERE cases.id = provenance_records.value_case_id
            AND security.user_has_tenant_access(cases.organization_id::text)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.cases
          WHERE cases.id = provenance_records.value_case_id
            AND security.user_has_tenant_access(cases.organization_id::text)
        )
      );

    CREATE POLICY provenance_records_service_role ON public.provenance_records
      AS RESTRICTIVE FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- 6) saga_transitions: restrictive membership checks + dedicated service role
-- Guarded: table may not exist in all environments.
-- --------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saga_transitions') THEN
    DROP POLICY IF EXISTS saga_transitions_tenant_scoped ON public.saga_transitions;
    DROP POLICY IF EXISTS "Saga transitions are tenant-scoped" ON public.saga_transitions;
    DROP POLICY IF EXISTS saga_transitions_select ON public.saga_transitions;
    DROP POLICY IF EXISTS saga_transitions_insert ON public.saga_transitions;
    DROP POLICY IF EXISTS saga_transitions_update ON public.saga_transitions;
    DROP POLICY IF EXISTS saga_transitions_delete ON public.saga_transitions;
    DROP POLICY IF EXISTS saga_transitions_service_role ON public.saga_transitions;

    CREATE POLICY saga_transitions_select ON public.saga_transitions
      AS RESTRICTIVE FOR SELECT TO authenticated
      USING (security.user_has_tenant_access(organization_id::text));

    CREATE POLICY saga_transitions_insert ON public.saga_transitions
      AS RESTRICTIVE FOR INSERT TO authenticated
      WITH CHECK (security.user_has_tenant_access(organization_id::text));

    CREATE POLICY saga_transitions_update ON public.saga_transitions
      AS RESTRICTIVE FOR UPDATE TO authenticated
      USING (security.user_has_tenant_access(organization_id::text))
      WITH CHECK (security.user_has_tenant_access(organization_id::text));

    CREATE POLICY saga_transitions_delete ON public.saga_transitions
      AS RESTRICTIVE FOR DELETE TO authenticated
      USING (security.user_has_tenant_access(organization_id::text));

    CREATE POLICY saga_transitions_service_role ON public.saga_transitions
      AS RESTRICTIVE FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;

-- Verification query: should return zero rows.
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
  AND (
    COALESCE(qual, '') ~* 'auth\\.jwt\\(\\)'
    OR COALESCE(with_check, '') ~* 'auth\\.jwt\\(\\)'
    OR (
      roles @> ARRAY['authenticated']::name[]
      AND (
        COALESCE(qual, '') ~* 'auth\\.role\\(\\)\\s*=\\s*''service_role'''
        OR COALESCE(with_check, '') ~* 'auth\\.role\\(\\)\\s*=\\s*''service_role'''
      )
    )
  )
ORDER BY tablename, policyname;
