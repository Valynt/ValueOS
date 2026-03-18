-- Migration: Create case_artifacts and artifact_edits tables for Executive Output Generation
-- Tasks: 1.1, 1.2, 1.3

SET search_path = public, pg_temp;

-- 1. Create case_artifacts table
CREATE TABLE IF NOT EXISTS public.case_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  organization_id uuid NOT NULL,
  case_id uuid NOT NULL,
  artifact_type text NOT NULL CHECK (artifact_type IN ('executive_memo', 'cfo_recommendation', 'customer_narrative', 'internal_case')),
  content_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
  readiness_score_at_generation numeric(3,2) NOT NULL DEFAULT 0.0 CHECK (readiness_score_at_generation >= 0 AND readiness_score_at_generation <= 1),
  generated_by_agent text NOT NULL DEFAULT 'NarrativeAgent',
  provenance_refs jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.case_artifacts IS 'Stores generated executive artifacts for value cases';
COMMENT ON COLUMN public.case_artifacts.artifact_type IS 'Type: executive_memo, cfo_recommendation, customer_narrative, internal_case';
COMMENT ON COLUMN public.case_artifacts.content_json IS 'Structured artifact content with traceability metadata';
COMMENT ON COLUMN public.case_artifacts.readiness_score_at_generation IS 'Defense readiness score when artifact was generated';
COMMENT ON COLUMN public.case_artifacts.provenance_refs IS 'Array of claim/data source references for traceability';

-- Indexes for case_artifacts
CREATE INDEX IF NOT EXISTS idx_case_artifacts_tenant_case ON public.case_artifacts (tenant_id, case_id);
CREATE INDEX IF NOT EXISTS idx_case_artifacts_type ON public.case_artifacts (artifact_type);
CREATE INDEX IF NOT EXISTS idx_case_artifacts_status ON public.case_artifacts (status);
CREATE INDEX IF NOT EXISTS idx_case_artifacts_created_at ON public.case_artifacts (created_at DESC);

-- 2. Create artifact_edits table for audit trail
CREATE TABLE IF NOT EXISTS public.artifact_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  organization_id uuid NOT NULL,
  artifact_id uuid NOT NULL REFERENCES public.case_artifacts(id) ON DELETE CASCADE,
  field_path text NOT NULL,
  old_value text,
  new_value text NOT NULL,
  edited_by_user_id uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.artifact_edits IS 'Audit trail for user edits to generated artifacts';
COMMENT ON COLUMN public.artifact_edits.field_path IS 'JSON path to the edited field (e.g., "executive_summary")';
COMMENT ON COLUMN public.artifact_edits.old_value IS 'Previous value before edit';
COMMENT ON COLUMN public.artifact_edits.new_value IS 'New value after edit';
COMMENT ON COLUMN public.artifact_edits.reason IS 'Optional reason provided by editor';

-- Indexes for artifact_edits
CREATE INDEX IF NOT EXISTS idx_artifact_edits_artifact ON public.artifact_edits (artifact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_edits_tenant ON public.artifact_edits (tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifact_edits_created_at ON public.artifact_edits (created_at DESC);

-- 3. Enable RLS on both tables
ALTER TABLE public.case_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_edits FORCE ROW LEVEL SECURITY;

-- 4. Create RLS policies for case_artifacts
-- SELECT policy: Users can read artifacts in their tenant
CREATE POLICY case_artifacts_tenant_select
  ON public.case_artifacts
  FOR SELECT
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR tenant_id = (auth.jwt() ->> 'tenant_id')
  );

-- INSERT policy: Users can create artifacts in their tenant
CREATE POLICY case_artifacts_tenant_insert
  ON public.case_artifacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.role() = 'service_role'
    OR tenant_id = (auth.jwt() ->> 'tenant_id')
  );

-- UPDATE policy: Users can update artifacts in their tenant
CREATE POLICY case_artifacts_tenant_update
  ON public.case_artifacts
  FOR UPDATE
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR tenant_id = (auth.jwt() ->> 'tenant_id')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR tenant_id = (auth.jwt() ->> 'tenant_id')
  );

-- DELETE policy: Users can delete artifacts in their tenant
CREATE POLICY case_artifacts_tenant_delete
  ON public.case_artifacts
  FOR DELETE
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR tenant_id = (auth.jwt() ->> 'tenant_id')
  );

-- Service role bypass for case_artifacts
CREATE POLICY case_artifacts_service_role_all
  ON public.case_artifacts
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5. Create RLS policies for artifact_edits
-- SELECT policy: Users can read edits in their tenant
CREATE POLICY artifact_edits_tenant_select
  ON public.artifact_edits
  FOR SELECT
  TO authenticated
  USING (
    auth.role() = 'service_role'
    OR tenant_id = (auth.jwt() ->> 'tenant_id')
  );

-- INSERT policy: Users can create edit records in their tenant
CREATE POLICY artifact_edits_tenant_insert
  ON public.artifact_edits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.role() = 'service_role'
    OR tenant_id = (auth.jwt() ->> 'tenant_id')
  );

-- UPDATE policy: Edit records are immutable - no updates allowed
-- (users can only create new edits, not modify existing ones)

-- DELETE policy: Edit records are immutable - no deletes allowed

-- Service role bypass for artifact_edits
CREATE POLICY artifact_edits_service_role_all
  ON public.artifact_edits
  FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 6. Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for case_artifacts
DROP TRIGGER IF EXISTS trg_case_artifacts_updated_at ON public.case_artifacts;
CREATE TRIGGER trg_case_artifacts_updated_at
  BEFORE UPDATE ON public.case_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 7. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_artifacts TO authenticated;
GRANT SELECT, INSERT ON public.artifact_edits TO authenticated;
GRANT ALL ON public.case_artifacts TO service_role;
GRANT ALL ON public.artifact_edits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.case_artifacts_id_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.artifact_edits_id_seq TO authenticated, service_role;
