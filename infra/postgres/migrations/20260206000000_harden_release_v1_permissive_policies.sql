-- ============================================================================
-- Harden permissive authenticated policies from 20240101000000_release_v1.sql
-- ============================================================================
-- This migration removes broad `TO authenticated USING (true)` and
-- `TO authenticated WITH CHECK (true)` policies and replaces them with
-- explicit least-privilege rules.

-- Helper: auth.uid()-based tenant membership predicate for tenant-scoped RLS.
CREATE SCHEMA IF NOT EXISTS security;

CREATE OR REPLACE FUNCTION security.is_current_user_tenant_member(p_tenant_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_tenants ut
    WHERE ut.tenant_id = p_tenant_id
      AND ut.user_id = auth.uid()::text
      AND ut.status = 'active'
  );
$$;

COMMENT ON FUNCTION security.is_current_user_tenant_member(text)
  IS 'Returns true when auth.uid() is an active member of the supplied tenant_id.';

REVOKE ALL ON FUNCTION security.is_current_user_tenant_member(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION security.is_current_user_tenant_member(text) TO authenticated, service_role;

-- --------------------------------------------------------------------------
-- workflows (tenant-scoped): authenticated users may only access rows for
-- tenants where auth.uid() has active membership. Existing owner/case policies
-- continue to provide additional per-row constraints.
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow read access to workflows" ON public.workflows;
DROP POLICY IF EXISTS workflows_tenant_isolation ON public.workflows;

CREATE POLICY workflows_tenant_membership_guard
  ON public.workflows
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (security.is_current_user_tenant_member(tenant_id))
  WITH CHECK (security.is_current_user_tenant_member(tenant_id));

-- --------------------------------------------------------------------------
-- academy_modules / academy_lessons (global reference curriculum):
-- shared read-only for authenticated users; writes reserved to service/admin.
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Academy modules are viewable by authenticated users" ON public.academy_modules;
CREATE POLICY academy_modules_authenticated_read
  ON public.academy_modules
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Academy lessons are viewable by authenticated users" ON public.academy_lessons;
CREATE POLICY academy_lessons_authenticated_read
  ON public.academy_lessons
  FOR SELECT
  TO authenticated
  USING (true);

-- --------------------------------------------------------------------------
-- agents / policy_rules (global operational reference data):
-- shared read-only for authenticated users; writes restricted to service role.
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow read access to agents" ON public.agents;
CREATE POLICY agents_authenticated_read
  ON public.agents
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow read access to policy rules" ON public.policy_rules;
CREATE POLICY policy_rules_authenticated_read
  ON public.policy_rules
  FOR SELECT
  TO authenticated
  USING (true);

-- --------------------------------------------------------------------------
-- feature_flags / prompt_versions / ab_tests / golden_examples (global config
-- and evaluation assets): authenticated users can read; writes are denied to
-- authenticated and must flow through trusted service/admin paths.
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Feature flags are deletable by authenticated users" ON public.feature_flags;
DROP POLICY IF EXISTS "Feature flags are insertable by authenticated users" ON public.feature_flags;
DROP POLICY IF EXISTS "Feature flags are updatable by authenticated users" ON public.feature_flags;
DROP POLICY IF EXISTS "Feature flags are viewable by authenticated users" ON public.feature_flags;
CREATE POLICY feature_flags_authenticated_read
  ON public.feature_flags
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Prompt versions are insertable by authenticated users" ON public.prompt_versions;
DROP POLICY IF EXISTS "Prompt versions are updatable by authenticated users" ON public.prompt_versions;
DROP POLICY IF EXISTS "Prompt versions are viewable by authenticated users" ON public.prompt_versions;
CREATE POLICY prompt_versions_authenticated_read
  ON public.prompt_versions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "A/B tests are insertable by authenticated users" ON public.ab_tests;
DROP POLICY IF EXISTS "A/B tests are updatable by authenticated users" ON public.ab_tests;
DROP POLICY IF EXISTS "A/B tests are viewable by authenticated users" ON public.ab_tests;
CREATE POLICY ab_tests_authenticated_read
  ON public.ab_tests
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Golden examples are insertable by authenticated users" ON public.golden_examples;
DROP POLICY IF EXISTS "Golden examples are updatable by authenticated users" ON public.golden_examples;
DROP POLICY IF EXISTS "Golden examples are viewable by authenticated users" ON public.golden_examples;
CREATE POLICY golden_examples_authenticated_read
  ON public.golden_examples
  FOR SELECT
  TO authenticated
  USING (true);

-- --------------------------------------------------------------------------
-- evaluation_runs (global analytics history): read-only to authenticated;
-- service role owns write path.
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Evaluation runs are insertable by authenticated users" ON public.evaluation_runs;
DROP POLICY IF EXISTS "Evaluation runs are viewable by authenticated users" ON public.evaluation_runs;
CREATE POLICY evaluation_runs_authenticated_read
  ON public.evaluation_runs
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS evaluation_runs_service_write ON public.evaluation_runs;
CREATE POLICY evaluation_runs_service_write
  ON public.evaluation_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- --------------------------------------------------------------------------
-- feature_flag_evaluations / llm_job_results (user-attributed events):
-- authenticated users may insert only rows attributable to auth.uid();
-- existing select policies already scope reads to own rows.
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Evaluations are insertable by authenticated users" ON public.feature_flag_evaluations;
CREATE POLICY feature_flag_evaluations_insert_own
  ON public.feature_flag_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Job results are insertable by authenticated users" ON public.llm_job_results;
CREATE POLICY llm_job_results_insert_own
  ON public.llm_job_results
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
