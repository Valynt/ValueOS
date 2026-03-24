-- Rollback: value_cases consistency alignment
-- Reverts 20260323000002_value_cases_consistency_alignment.sql

SET search_path = public, pg_temp;

-- 1. Remove integrity-related columns
ALTER TABLE public.value_cases
    DROP COLUMN IF EXISTS integrity_score,
    DROP COLUMN IF EXISTS integrity_evaluated_at;

-- 2. Drop new index
DROP INDEX IF EXISTS idx_value_cases_integrity_score;

-- 3. Revert status check constraint to original values
ALTER TABLE public.value_cases
    DROP CONSTRAINT IF EXISTS value_cases_status_check;

ALTER TABLE public.value_cases
    ADD CONSTRAINT value_cases_status_check CHECK (
        status = ANY (ARRAY['draft','review','published','archived'])
    );

-- Note: Status value migration from new to old is not reversible without
-- data loss. The mapping would be:
--   'in_progress' -> 'review'
--   'committed' -> 'published'
-- Manual intervention required if rollback is needed after data migration.
