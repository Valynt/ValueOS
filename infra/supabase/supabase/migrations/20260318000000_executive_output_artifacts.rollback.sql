-- Rollback: 20260318000000_executive_output_artifacts.sql
-- Drops case_artifacts and artifact_edits tables

SET search_path = public, pg_temp;

-- Drop triggers
DROP TRIGGER IF EXISTS trg_case_artifacts_updated_at ON public.case_artifacts;

-- Drop policies
DROP POLICY IF EXISTS case_artifacts_tenant_select ON public.case_artifacts;
DROP POLICY IF EXISTS case_artifacts_tenant_insert ON public.case_artifacts;
DROP POLICY IF EXISTS case_artifacts_tenant_update ON public.case_artifacts;
DROP POLICY IF EXISTS case_artifacts_tenant_delete ON public.case_artifacts;
DROP POLICY IF EXISTS case_artifacts_service_role_all ON public.case_artifacts;

DROP POLICY IF EXISTS artifact_edits_tenant_select ON public.artifact_edits;
DROP POLICY IF EXISTS artifact_edits_tenant_insert ON public.artifact_edits;
DROP POLICY IF EXISTS artifact_edits_service_role_all ON public.artifact_edits;

-- Drop tables (cascade to handle foreign key)
DROP TABLE IF EXISTS public.artifact_edits;
DROP TABLE IF EXISTS public.case_artifacts;
