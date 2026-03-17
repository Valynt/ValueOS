-- Migration: agent_execution_lineage
-- Append-only record of every agent secureInvoke call: which memory entries
-- were read, which tools were called, and which DB tables were written.
-- Used by the lineage API (GET /api/v1/cases/:caseId/lineage) and the
-- per-execution lineage UI (UX-04).

SET search_path = public, pg_temp;

-- ============================================================
-- Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agent_execution_lineage (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID        NOT NULL,
    agent_name      TEXT        NOT NULL,
    organization_id UUID        NOT NULL,
    memory_reads    JSONB       NOT NULL DEFAULT '[]'::JSONB,
    tool_calls      JSONB       NOT NULL DEFAULT '[]'::JSONB,
    db_writes       JSONB       NOT NULL DEFAULT '[]'::JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_agent_execution_lineage_org_id
    ON public.agent_execution_lineage (organization_id);

CREATE INDEX IF NOT EXISTS idx_agent_execution_lineage_session_id
    ON public.agent_execution_lineage (session_id);

CREATE INDEX IF NOT EXISTS idx_agent_execution_lineage_created_at
    ON public.agent_execution_lineage (created_at DESC);

-- ============================================================
-- Row-Level Security
-- ============================================================

ALTER TABLE public.agent_execution_lineage ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped SELECT: users may only read their own org's lineage
CREATE POLICY "agent_execution_lineage_select"
    ON public.agent_execution_lineage
    FOR SELECT
    USING (security.user_has_tenant_access(organization_id::text));

-- Tenant-scoped INSERT: agents write lineage rows for their own org
CREATE POLICY "agent_execution_lineage_insert"
    ON public.agent_execution_lineage
    FOR INSERT
    WITH CHECK (security.user_has_tenant_access(organization_id::text));

-- No UPDATE: lineage is append-only
CREATE POLICY "agent_execution_lineage_update"
    ON public.agent_execution_lineage
    FOR UPDATE
    USING (false);

-- No DELETE for regular users: lineage is immutable
-- service_role can delete for DSR erasure (bypasses RLS)
CREATE POLICY "agent_execution_lineage_delete"
    ON public.agent_execution_lineage
    FOR DELETE
    USING (false);

-- ============================================================
-- Grants
-- ============================================================

GRANT SELECT, INSERT ON public.agent_execution_lineage TO authenticated;
GRANT ALL ON public.agent_execution_lineage TO service_role;
