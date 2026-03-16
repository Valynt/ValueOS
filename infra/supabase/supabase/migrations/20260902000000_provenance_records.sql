-- ============================================================================
-- provenance_records — append-only derivation trail for agent-generated claims
--
-- Written by TargetAgent and FinancialModelingAgent after each node/model
-- write. Enables full lineage queries: which agent, which version, which
-- evidence tier, and what formula produced a given claim.
--
-- Append-only: no UPDATE or DELETE RLS policies are granted.
-- Tenant isolation: every row carries organization_id (NOT NULL).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.provenance_records (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  value_case_id    uuid        NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE,
  claim_id         text        NOT NULL,
  organization_id  uuid        NOT NULL,
  data_source      text        NOT NULL,
  evidence_tier    smallint    NOT NULL CHECK (evidence_tier IN (1, 2, 3)),
  formula          text,
  agent_id         text        NOT NULL,
  agent_version    text        NOT NULL,
  confidence_score numeric(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  parent_record_id uuid        REFERENCES public.provenance_records(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Tenant-scoped lookup by claim
CREATE INDEX IF NOT EXISTS provenance_records_case_claim_idx
  ON public.provenance_records (value_case_id, claim_id, organization_id);

-- Tenant-scoped lookup by case (full lineage)
CREATE INDEX IF NOT EXISTS provenance_records_case_org_idx
  ON public.provenance_records (value_case_id, organization_id);

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.provenance_records ENABLE ROW LEVEL SECURITY;

-- SELECT: tenant members read their own rows
CREATE POLICY "provenance_records_select"
  ON public.provenance_records FOR SELECT
  USING (security.user_has_tenant_access(organization_id));

-- INSERT: tenant members append records for their own tenant
CREATE POLICY "provenance_records_insert"
  ON public.provenance_records FOR INSERT
  WITH CHECK (security.user_has_tenant_access(organization_id));

-- No UPDATE or DELETE policies — append-only by design.

GRANT ALL ON public.provenance_records TO service_role;
GRANT SELECT, INSERT ON public.provenance_records TO authenticated;

COMMIT;
