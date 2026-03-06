-- ============================================================================
-- ROLLBACK: 20260303010000_value_cases_stage_and_portfolio_rpc
-- Removes the stage column from value_cases and drops the portfolio RPC.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.compute_portfolio_value(text) CASCADE;

DROP INDEX IF EXISTS public.idx_value_cases_stage;

ALTER TABLE public.value_cases
    DROP COLUMN IF EXISTS stage;
