-- Academy schema governance decision:
-- Academy lives in the same Supabase project/database domain as the platform.
-- Table classification:
--   Global reference tables: academy_modules, academy_lessons
--   Tenant-scoped tables:   academy_progress, academy_certifications

BEGIN;

-- ---------------------------------------------------------------------------
-- Tenant-scoped academy_progress: enforce tenant membership in RLS policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own progress" ON public.academy_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON public.academy_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON public.academy_progress;

CREATE POLICY academy_progress_select_own_tenant
  ON public.academy_progress
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND tenant_id::text = ANY(get_user_tenant_ids(auth.uid()))
  );

CREATE POLICY academy_progress_insert_own_tenant
  ON public.academy_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND tenant_id::text = ANY(get_user_tenant_ids(auth.uid()))
  );

CREATE POLICY academy_progress_update_own_tenant
  ON public.academy_progress
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND tenant_id::text = ANY(get_user_tenant_ids(auth.uid()))
  )
  WITH CHECK (
    auth.uid() = user_id
    AND tenant_id::text = ANY(get_user_tenant_ids(auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Tenant-scoped academy_certifications: enforce tenant membership in RLS policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own certifications" ON public.academy_certifications;

CREATE POLICY academy_certifications_select_own_tenant
  ON public.academy_certifications
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND tenant_id::text = ANY(get_user_tenant_ids(auth.uid()))
  );

COMMIT;
