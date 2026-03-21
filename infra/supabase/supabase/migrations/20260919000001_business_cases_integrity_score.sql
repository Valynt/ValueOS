-- Migration: business_cases integrity_score column
-- Sprint 53 — Value Integrity Layer
--
-- Adds the composite integrity_score field to business_cases.
-- Score is computed by ValueIntegrityService after each agent run:
--   integrity_score = 0.5 * defense_readiness_score
--                   + 0.5 * (1 - sum(violation_penalties))
-- Clamped to [0, 1]. NULL until first computation.

SET search_path = public, pg_temp;

ALTER TABLE public.business_cases
    ADD COLUMN IF NOT EXISTS integrity_score NUMERIC(4,3)
        CHECK (integrity_score >= 0 AND integrity_score <= 1);

COMMENT ON COLUMN public.business_cases.integrity_score IS
    'Composite integrity score (0-1). '
    '0.5 * defense_readiness_score + 0.5 * (1 - sum(violation_penalties)). '
    'NULL until ValueIntegrityService first runs for this case.';
