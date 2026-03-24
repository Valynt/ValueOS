-- Migration: Add integrity_score to value_cases and align status enum
-- Sprint alignment — Value Model Consistency Improvements
--
-- PURPOSE
-- -------
-- 1. Adds integrity_score column to value_cases for materialized integrity tracking
-- 2. Aligns value_cases.status check constraint with API CaseStatus enum
--
-- BACKGROUND
-- ----------
-- The integrity_score was previously only on business_cases table. For consistent
-- value model tracking, value_cases also needs this column to store the computed
-- integrity score from ValueIntegrityService.
--
-- The status enum check constraint is being updated to align with the API
-- CaseStatus enum: ['draft', 'in_progress', 'committed', 'closed']

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. Add integrity_score column to value_cases
-- ============================================================================

ALTER TABLE public.value_cases
    ADD COLUMN IF NOT EXISTS integrity_score NUMERIC(4,3)
        CHECK (integrity_score >= 0 AND integrity_score <= 1);

COMMENT ON COLUMN public.value_cases.integrity_score IS
    'Composite integrity score (0-1) computed by ValueIntegrityService. '
    '0.5 * defense_readiness_score + 0.5 * (1 - sum(violation_penalties)). '
    'NULL until first computation. Score < 0.6 blocks stage advancement.';

-- ============================================================================
-- 2. Add integrity-related timestamp tracking
-- ============================================================================

ALTER TABLE public.value_cases
    ADD COLUMN IF NOT EXISTS integrity_evaluated_at timestamptz;

COMMENT ON COLUMN public.value_cases.integrity_evaluated_at IS
    'When integrity was last evaluated. Used for audit trail and caching decisions.';

-- ============================================================================
-- 3. Update status check constraint to align with API CaseStatus enum
-- ============================================================================

-- Drop old constraint if exists
ALTER TABLE public.value_cases
    DROP CONSTRAINT IF EXISTS value_cases_status_check;

-- Add updated constraint aligned with API CaseStatus enum
ALTER TABLE public.value_cases
    ADD CONSTRAINT value_cases_status_check CHECK (
        status = ANY (ARRAY['draft', 'in_progress', 'committed', 'closed'])
    );

-- ============================================================================
-- 4. Create index for integrity_score queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_value_cases_integrity_score
    ON public.value_cases (integrity_score)
    WHERE integrity_score IS NOT NULL;

-- ============================================================================
-- 5. Update existing rows: migrate old status values
-- ============================================================================

-- Map old status values to new aligned values
UPDATE public.value_cases
SET status = CASE status
    WHEN 'review' THEN 'in_progress'
    WHEN 'published' THEN 'committed'
    ELSE status  -- 'draft' and 'archived' remain unchanged
END
WHERE status IN ('review', 'published');
