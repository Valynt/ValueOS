SET search_path = public, pg_temp;

BEGIN;

-- rls-classification: tenant_scoped
CREATE TABLE IF NOT EXISTS public.claim_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  hypothesis_id uuid REFERENCES public.value_hypotheses(id) ON DELETE SET NULL,
  claim_text text NOT NULL CHECK (char_length(claim_text) BETWEEN 1 AND 4000),
  impact_level text NOT NULL DEFAULT 'medium' CHECK (impact_level IN ('low', 'medium', 'high')),
  created_by_agent text NOT NULL DEFAULT 'human',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_nodes_org_opp ON public.claim_nodes (organization_id, opportunity_id);

ALTER TABLE public.claim_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS claim_nodes_select ON public.claim_nodes;
DROP POLICY IF EXISTS claim_nodes_insert ON public.claim_nodes;
DROP POLICY IF EXISTS claim_nodes_update ON public.claim_nodes;
DROP POLICY IF EXISTS claim_nodes_delete ON public.claim_nodes;

CREATE POLICY claim_nodes_select ON public.claim_nodes FOR SELECT USING (security.user_has_tenant_access(organization_id));
CREATE POLICY claim_nodes_insert ON public.claim_nodes FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id));
CREATE POLICY claim_nodes_update ON public.claim_nodes FOR UPDATE USING (security.user_has_tenant_access(organization_id)) WITH CHECK (security.user_has_tenant_access(organization_id));
CREATE POLICY claim_nodes_delete ON public.claim_nodes FOR DELETE USING (security.user_has_tenant_access(organization_id));

GRANT ALL ON public.claim_nodes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_nodes TO authenticated;

-- rls-classification: tenant_scoped
CREATE TABLE IF NOT EXISTS public.evidence_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  artifact_type text NOT NULL,
  source_uri text,
  title text NOT NULL,
  excerpt text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version_no integer NOT NULL DEFAULT 1 CHECK (version_no > 0),
  supersedes_id uuid REFERENCES public.evidence_artifacts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_artifacts_org_opp ON public.evidence_artifacts (organization_id, opportunity_id);
CREATE INDEX IF NOT EXISTS idx_evidence_artifacts_supersedes ON public.evidence_artifacts (supersedes_id);

ALTER TABLE public.evidence_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evidence_artifacts_select ON public.evidence_artifacts;
DROP POLICY IF EXISTS evidence_artifacts_insert ON public.evidence_artifacts;
DROP POLICY IF EXISTS evidence_artifacts_update ON public.evidence_artifacts;
DROP POLICY IF EXISTS evidence_artifacts_delete ON public.evidence_artifacts;

CREATE POLICY evidence_artifacts_select ON public.evidence_artifacts FOR SELECT USING (security.user_has_tenant_access(organization_id));
CREATE POLICY evidence_artifacts_insert ON public.evidence_artifacts FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id));
CREATE POLICY evidence_artifacts_update ON public.evidence_artifacts FOR UPDATE USING (security.user_has_tenant_access(organization_id)) WITH CHECK (security.user_has_tenant_access(organization_id));
CREATE POLICY evidence_artifacts_delete ON public.evidence_artifacts FOR DELETE USING (security.user_has_tenant_access(organization_id));

GRANT ALL ON public.evidence_artifacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_artifacts TO authenticated;

-- rls-classification: tenant_scoped
CREATE TABLE IF NOT EXISTS public.claim_evidence_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES public.claim_nodes(id) ON DELETE CASCADE,
  evidence_artifact_id uuid NOT NULL REFERENCES public.evidence_artifacts(id) ON DELETE CASCADE,
  edge_type text NOT NULL CHECK (edge_type IN ('supports', 'contradicts', 'insufficient_for')),
  rationale text,
  created_by text NOT NULL DEFAULT 'agent',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, opportunity_id, claim_id, evidence_artifact_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_claim_evidence_edges_claim ON public.claim_evidence_edges (organization_id, opportunity_id, claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_edges_evidence ON public.claim_evidence_edges (organization_id, opportunity_id, evidence_artifact_id);

ALTER TABLE public.claim_evidence_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS claim_evidence_edges_select ON public.claim_evidence_edges;
DROP POLICY IF EXISTS claim_evidence_edges_insert ON public.claim_evidence_edges;
DROP POLICY IF EXISTS claim_evidence_edges_update ON public.claim_evidence_edges;
DROP POLICY IF EXISTS claim_evidence_edges_delete ON public.claim_evidence_edges;

CREATE POLICY claim_evidence_edges_select ON public.claim_evidence_edges FOR SELECT USING (security.user_has_tenant_access(organization_id));
CREATE POLICY claim_evidence_edges_insert ON public.claim_evidence_edges FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id));
CREATE POLICY claim_evidence_edges_update ON public.claim_evidence_edges FOR UPDATE USING (security.user_has_tenant_access(organization_id)) WITH CHECK (security.user_has_tenant_access(organization_id));
CREATE POLICY claim_evidence_edges_delete ON public.claim_evidence_edges FOR DELETE USING (security.user_has_tenant_access(organization_id));

GRANT ALL ON public.claim_evidence_edges TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_evidence_edges TO authenticated;

-- rls-classification: tenant_scoped
CREATE TABLE IF NOT EXISTS public.claim_confidence_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES public.claim_nodes(id) ON DELETE CASCADE,
  run_id text,
  lifecycle_stage text,
  confidence_score numeric NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  evidence_coverage_score numeric NOT NULL CHECK (evidence_coverage_score >= 0 AND evidence_coverage_score <= 1),
  scorer_name text NOT NULL,
  scorer_version text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  rationale text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_confidence_snapshots_claim_recorded ON public.claim_confidence_snapshots (organization_id, opportunity_id, claim_id, recorded_at);

ALTER TABLE public.claim_confidence_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS claim_confidence_snapshots_select ON public.claim_confidence_snapshots;
DROP POLICY IF EXISTS claim_confidence_snapshots_insert ON public.claim_confidence_snapshots;
DROP POLICY IF EXISTS claim_confidence_snapshots_update ON public.claim_confidence_snapshots;
DROP POLICY IF EXISTS claim_confidence_snapshots_delete ON public.claim_confidence_snapshots;

CREATE POLICY claim_confidence_snapshots_select ON public.claim_confidence_snapshots FOR SELECT USING (security.user_has_tenant_access(organization_id));
CREATE POLICY claim_confidence_snapshots_insert ON public.claim_confidence_snapshots FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id));
CREATE POLICY claim_confidence_snapshots_update ON public.claim_confidence_snapshots FOR UPDATE USING (security.user_has_tenant_access(organization_id)) WITH CHECK (security.user_has_tenant_access(organization_id));
CREATE POLICY claim_confidence_snapshots_delete ON public.claim_confidence_snapshots FOR DELETE USING (security.user_has_tenant_access(organization_id));

GRANT ALL ON public.claim_confidence_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_confidence_snapshots TO authenticated;

COMMIT;
