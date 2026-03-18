-- ============================================================================
-- Executive Output Generation — Case Artifacts and Edit Tracking
--
-- Stores generated executive artifacts (memos, recommendations, narratives)
-- with full edit audit trail for traceability.
--
-- Tenant isolation: every row carries tenant_id (NOT NULL).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. case_artifacts — Generated executive output artifacts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.case_artifacts (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               uuid NOT NULL,
    case_id                 uuid NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE,
    artifact_type           text NOT NULL,
    content_json            jsonb NOT NULL DEFAULT '{}'::jsonb,
    status                  text NOT NULL DEFAULT 'draft',
    readiness_score_at_generation numeric(5,4) CHECK (readiness_score_at_generation >= 0 AND readiness_score_at_generation <= 1),
    generated_by_agent      text NOT NULL,
    generation_prompt_hash  text,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT case_artifacts_artifact_type_check CHECK (artifact_type IN (
        'executive_memo', 'cfo_recommendation', 'customer_narrative', 'internal_case'
    )),
    CONSTRAINT case_artifacts_status_check CHECK (status IN ('draft', 'final'))
);

COMMENT ON TABLE public.case_artifacts IS 'Generated executive output artifacts per value case';

CREATE INDEX IF NOT EXISTS case_artifacts_tenant_case_idx ON public.case_artifacts (tenant_id, case_id);
CREATE INDEX IF NOT EXISTS case_artifacts_case_type_idx ON public.case_artifacts (case_id, artifact_type);
CREATE INDEX IF NOT EXISTS case_artifacts_status_idx ON public.case_artifacts (status);

-- ============================================================================
-- 2. artifact_edits — Audit trail for user modifications to artifacts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.artifact_edits (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               uuid NOT NULL,
    artifact_id             uuid NOT NULL REFERENCES public.case_artifacts(id) ON DELETE CASCADE,
    field_path              text NOT NULL,
    old_value               jsonb,
    new_value               jsonb NOT NULL,
    edited_by_user_id       uuid NOT NULL REFERENCES public.users(id),
    reason                  text,
    created_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.artifact_edits IS 'Audit trail of user edits to generated artifacts';

CREATE INDEX IF NOT EXISTS artifact_edits_artifact_idx ON public.artifact_edits (artifact_id);
CREATE INDEX IF NOT EXISTS artifact_edits_tenant_artifact_idx ON public.artifact_edits (tenant_id, artifact_id);
CREATE INDEX IF NOT EXISTS artifact_edits_user_idx ON public.artifact_edits (edited_by_user_id);

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE public.case_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifact_edits ENABLE ROW LEVEL SECURITY;

-- case_artifacts RLS
CREATE POLICY "case_artifacts_select"
  ON public.case_artifacts FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY "case_artifacts_insert"
  ON public.case_artifacts FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "case_artifacts_update"
  ON public.case_artifacts FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "case_artifacts_delete"
  ON public.case_artifacts FOR DELETE
  USING (security.user_has_tenant_access(tenant_id));

-- artifact_edits RLS (append-only design — no UPDATE/DELETE)
CREATE POLICY "artifact_edits_select"
  ON public.artifact_edits FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY "artifact_edits_insert"
  ON public.artifact_edits FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

-- No UPDATE or DELETE — edit history is immutable

-- ============================================================================
-- Grants
-- ============================================================================

GRANT ALL ON public.case_artifacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_artifacts TO authenticated;

GRANT ALL ON public.artifact_edits TO service_role;
GRANT SELECT, INSERT ON public.artifact_edits TO authenticated;

COMMIT;
