-- integrity_outputs
--
-- Persists IntegrityAgent output for each value case.
-- One row per case (upsert semantics — a re-run replaces the prior output).
-- All rows are tenant-scoped via organization_id.

CREATE TABLE IF NOT EXISTS public.integrity_outputs (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            uuid        NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE,
  organization_id    uuid        NOT NULL,
  agent_run_id       uuid,
  -- Array of { claim_id, text, confidence_score, evidence_tier, flagged, flag_reason }
  claims             jsonb       NOT NULL DEFAULT '[]',
  overall_confidence numeric     CHECK (overall_confidence >= 0 AND overall_confidence <= 1),
  veto_triggered     boolean     NOT NULL DEFAULT false,
  veto_reason        text,
  source_agent       text        NOT NULL DEFAULT 'IntegrityAgent',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint required for ON CONFLICT upsert semantics (one row per case).
-- Also serves as the hot read index for case + tenant queries.
CREATE UNIQUE INDEX IF NOT EXISTS idx_integrity_outputs_case_org
  ON public.integrity_outputs (case_id, organization_id);

ALTER TABLE public.integrity_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY integrity_outputs_tenant_select
  ON public.integrity_outputs FOR SELECT
  USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY integrity_outputs_tenant_insert
  ON public.integrity_outputs FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY integrity_outputs_tenant_update
  ON public.integrity_outputs FOR UPDATE
  USING (security.user_has_tenant_access(organization_id::text))
  WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY integrity_outputs_tenant_delete
  ON public.integrity_outputs FOR DELETE
  USING (security.user_has_tenant_access(organization_id::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrity_outputs TO authenticated;
