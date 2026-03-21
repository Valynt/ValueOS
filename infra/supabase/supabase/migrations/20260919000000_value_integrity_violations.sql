-- Migration: value_integrity_violations
-- Sprint 53 — Value Integrity Layer
--
-- Persists contradiction violations detected by ValueIntegrityService.
-- Each row represents a single detected issue within a business case.
-- RLS enforces tenant isolation via organization_id.

SET search_path = public, pg_temp;

-- ============================================================
-- 1. value_integrity_violations table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.value_integrity_violations (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             UUID        NOT NULL,
    organization_id     UUID        NOT NULL,

    -- Which contradiction pattern was detected.
    type                TEXT        NOT NULL CHECK (type IN (
                                        'SCALAR_CONFLICT',
                                        'FINANCIAL_SANITY',
                                        'LOGIC_CHAIN_BREAK',
                                        'UNIT_MISMATCH'
                                    )),

    -- Severity determines gate behaviour on status transitions.
    severity            TEXT        NOT NULL CHECK (severity IN (
                                        'critical',
                                        'warning',
                                        'info'
                                    )),

    -- Human-readable description of the contradiction.
    description         TEXT        NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),

    -- IDs of the agents whose outputs produced this violation.
    agent_ids           TEXT[]      NOT NULL DEFAULT '{}',

    -- Current resolution state.
    status              TEXT        NOT NULL DEFAULT 'OPEN' CHECK (status IN (
                                        'OPEN',
                                        'RESOLVED_AUTO',
                                        'DISMISSED'
                                    )),

    -- User ID or 'SYSTEM_AGENT' that resolved this violation. NULL while OPEN.
    resolved_by         TEXT,

    -- Stores dismissal reason/comment or re-evaluation timestamp.
    resolution_metadata JSONB,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_viv_org_case
    ON public.value_integrity_violations (organization_id, case_id);

CREATE INDEX IF NOT EXISTS idx_viv_org_case_status
    ON public.value_integrity_violations (organization_id, case_id, status);

CREATE INDEX IF NOT EXISTS idx_viv_org_case_severity
    ON public.value_integrity_violations (organization_id, case_id, severity)
    WHERE status = 'OPEN';

-- ============================================================
-- 3. updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_viv_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_viv_updated_at
    BEFORE UPDATE ON public.value_integrity_violations
    FOR EACH ROW EXECUTE FUNCTION public.set_viv_updated_at();

-- ============================================================
-- 4. Row Level Security
-- ============================================================

ALTER TABLE public.value_integrity_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "viv_select"
    ON public.value_integrity_violations
    FOR SELECT
    USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "viv_insert"
    ON public.value_integrity_violations
    FOR INSERT
    WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "viv_update"
    ON public.value_integrity_violations
    FOR UPDATE
    USING (security.user_has_tenant_access(organization_id::text))
    WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "viv_delete"
    ON public.value_integrity_violations
    FOR DELETE
    USING (security.user_has_tenant_access(organization_id::text));

-- ============================================================
-- 5. Grants
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.value_integrity_violations TO authenticated;
GRANT ALL ON public.value_integrity_violations TO service_role;
