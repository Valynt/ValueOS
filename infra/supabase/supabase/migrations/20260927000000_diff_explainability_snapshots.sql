SET search_path = public, pg_temp;

BEGIN;

-- rls-classification: tenant_scoped
CREATE TABLE IF NOT EXISTS public.diff_explainability_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_id text NOT NULL UNIQUE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.value_cases(id) ON DELETE SET NULL,
  run_a_id text NOT NULL,
  run_b_id text NOT NULL,
  human_decision_path_id text NOT NULL,
  agent_decision_path_id text NOT NULL,
  diff_payload jsonb NOT NULL,
  narrative_summary jsonb NOT NULL,
  references_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diff_explainability_snapshots_refs_array CHECK (jsonb_typeof(references_json) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_diff_explainability_org_created
  ON public.diff_explainability_snapshots (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_diff_explainability_org_case
  ON public.diff_explainability_snapshots (organization_id, case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_diff_explainability_stable_id
  ON public.diff_explainability_snapshots (stable_id);

CREATE OR REPLACE FUNCTION public.set_diff_explainability_snapshots_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_diff_explainability_snapshots_updated_at ON public.diff_explainability_snapshots;
CREATE TRIGGER trg_diff_explainability_snapshots_updated_at
  BEFORE UPDATE ON public.diff_explainability_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.set_diff_explainability_snapshots_updated_at();

ALTER TABLE public.diff_explainability_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diff_explainability_snapshots_select ON public.diff_explainability_snapshots;
CREATE POLICY diff_explainability_snapshots_select
  ON public.diff_explainability_snapshots
  FOR SELECT TO authenticated
  USING (security.user_has_tenant_access(organization_id::text));

DROP POLICY IF EXISTS diff_explainability_snapshots_insert ON public.diff_explainability_snapshots;
CREATE POLICY diff_explainability_snapshots_insert
  ON public.diff_explainability_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

DROP POLICY IF EXISTS diff_explainability_snapshots_update ON public.diff_explainability_snapshots;
CREATE POLICY diff_explainability_snapshots_update
  ON public.diff_explainability_snapshots
  FOR UPDATE TO authenticated
  USING (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

DROP POLICY IF EXISTS diff_explainability_snapshots_service_role_all ON public.diff_explainability_snapshots;
CREATE POLICY diff_explainability_snapshots_service_role_all
  ON public.diff_explainability_snapshots
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.diff_explainability_snapshots TO authenticated;
GRANT ALL ON public.diff_explainability_snapshots TO service_role;

COMMIT;
