-- Rollback: 20260303010000_value_cases_stage_and_portfolio_rpc.sql
-- Removes the stage column from value_cases and drops the compute_portfolio_value RPC.

SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.compute_portfolio_value(TEXT);

DROP INDEX IF EXISTS public.idx_value_cases_stage;

ALTER TABLE public.value_cases DROP COLUMN IF EXISTS stage;
