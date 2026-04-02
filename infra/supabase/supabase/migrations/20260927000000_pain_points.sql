-- =============================================================================
-- pain_points
--
-- First-class table for structured business problems surfaced during discovery.
-- Previously pain points were stored as TEXT[] or JSONB arrays on company_profiles
-- and company_personas. This migration promotes them to a governed entity with
-- a direct FK to value_cases (the canonical opportunity record), RLS, and an
-- audit trigger.
--
-- Spec reference: ValueOS Consolidated Spec §4.2 PainPoint
-- =============================================================================

SET search_path = public, pg_temp;

BEGIN;

CREATE TABLE IF NOT EXISTS public.pain_points (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL,
    -- FK to value_cases — the canonical opportunity record.
    -- ON DELETE CASCADE: removing a value case removes its pain points.
    case_id         uuid        NOT NULL REFERENCES public.value_cases(id) ON DELETE CASCADE,
    title           text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 255),
    description     text        NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
    status          text        NOT NULL DEFAULT 'inferred'
                                CHECK (status IN ('inferred', 'confirmed', 'rejected')),
    priority        text        NOT NULL DEFAULT 'medium'
                                CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    source          text        CHECK (char_length(source) <= 255),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Composite index covering the most common query pattern: all pain points for
-- a case, filtered by status (e.g. confirmed only before value modeling).
CREATE INDEX IF NOT EXISTS idx_pain_points_case_status
    ON public.pain_points (case_id, status);

CREATE INDEX IF NOT EXISTS idx_pain_points_org
    ON public.pain_points (organization_id);

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.pain_points_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pain_points_updated_at ON public.pain_points;
CREATE TRIGGER trg_pain_points_updated_at
    BEFORE UPDATE ON public.pain_points
    FOR EACH ROW EXECUTE FUNCTION public.pain_points_set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.pain_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pain_points_select ON public.pain_points;
CREATE POLICY pain_points_select
    ON public.pain_points FOR SELECT
    USING (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS pain_points_insert ON public.pain_points;
CREATE POLICY pain_points_insert
    ON public.pain_points FOR INSERT
    WITH CHECK (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS pain_points_update ON public.pain_points;
CREATE POLICY pain_points_update
    ON public.pain_points FOR UPDATE
    USING  (security.user_has_tenant_access(organization_id))
    WITH CHECK (security.user_has_tenant_access(organization_id));

DROP POLICY IF EXISTS pain_points_delete ON public.pain_points;
CREATE POLICY pain_points_delete
    ON public.pain_points FOR DELETE
    USING (security.user_has_tenant_access(organization_id));

-- ── Grants ────────────────────────────────────────────────────────────────────

GRANT ALL ON public.pain_points TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pain_points TO authenticated;

COMMIT;
