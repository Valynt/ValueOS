-- Migration: reasoning_traces
-- Persisted record of agent reasoning for every BaseAgent.secureInvoke call.
--
-- Dual-anchored:
--   value_case_id  — FK to value_cases.id; primary API query key (:caseId route param)
--   opportunity_id — nullable parent graph anchor; stored for lineage, not used in routes
--
-- Append-only: no UPDATE or DELETE for authenticated role.
-- service_role may DELETE for DSR erasure (bypasses RLS).
--
-- Sprint 51.

SET search_path = public, pg_temp;

-- ============================================================
-- Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reasoning_traces (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      UUID        NOT NULL,
    -- session_id is a logical link to agent_execution_lineage.session_id.
    -- agent_execution_lineage.session_id is not a PK/unique column, so a
    -- strict FK constraint is not possible. The link is enforced at the
    -- application layer (BaseAgent.secureInvoke writes both rows).
    session_id           UUID        NOT NULL,
    value_case_id        UUID        NOT NULL
                             REFERENCES public.value_cases(id) ON DELETE CASCADE,
    opportunity_id       UUID,
    agent_name           TEXT        NOT NULL,
    agent_version        TEXT        NOT NULL DEFAULT '1.0.0',
    trace_id             UUID        NOT NULL,
    inputs               JSONB       NOT NULL DEFAULT '{}'::JSONB,
    transformations      JSONB       NOT NULL DEFAULT '[]'::JSONB,
    assumptions          JSONB       NOT NULL DEFAULT '[]'::JSONB,
    confidence_breakdown JSONB       NOT NULL DEFAULT '{}'::JSONB,
    evidence_links       JSONB       NOT NULL DEFAULT '[]'::JSONB,
    grounding_score      NUMERIC(4,3),
    latency_ms           INTEGER,
    token_usage          JSONB,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_reasoning_traces_org_id
    ON public.reasoning_traces (organization_id);

-- Primary query path: GET /api/v1/cases/:caseId/reasoning-traces
CREATE INDEX IF NOT EXISTS idx_reasoning_traces_value_case_id
    ON public.reasoning_traces (value_case_id);

-- Secondary: graph-level lineage queries by opportunity
CREATE INDEX IF NOT EXISTS idx_reasoning_traces_opportunity_id
    ON public.reasoning_traces (opportunity_id);

CREATE INDEX IF NOT EXISTS idx_reasoning_traces_session_id
    ON public.reasoning_traces (session_id);

CREATE INDEX IF NOT EXISTS idx_reasoning_traces_created_at
    ON public.reasoning_traces (created_at DESC);

-- ============================================================
-- Row-Level Security
-- ============================================================

ALTER TABLE public.reasoning_traces ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped SELECT
CREATE POLICY "reasoning_traces_select"
    ON public.reasoning_traces
    FOR SELECT
    USING (security.user_has_tenant_access(organization_id::text));

-- Tenant-scoped INSERT: agents write traces for their own org
CREATE POLICY "reasoning_traces_insert"
    ON public.reasoning_traces
    FOR INSERT
    WITH CHECK (security.user_has_tenant_access(organization_id::text));

-- No UPDATE: append-only
CREATE POLICY "reasoning_traces_update"
    ON public.reasoning_traces
    FOR UPDATE
    USING (false);

-- No DELETE for authenticated: service_role handles DSR erasure via RLS bypass
CREATE POLICY "reasoning_traces_delete"
    ON public.reasoning_traces
    FOR DELETE
    USING (false);

-- ============================================================
-- Grants
-- ============================================================

GRANT SELECT, INSERT ON public.reasoning_traces TO authenticated;
GRANT ALL ON public.reasoning_traces TO service_role;
