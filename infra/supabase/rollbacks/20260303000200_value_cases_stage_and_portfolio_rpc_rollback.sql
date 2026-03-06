-- Rollback: 20260303000200_value_cases_stage_and_portfolio_rpc
-- Drops the portfolio RPC and the stage index/column.
DROP FUNCTION IF EXISTS public.compute_portfolio_value(TEXT);
DROP INDEX IF EXISTS public.idx_value_cases_stage;
ALTER TABLE public.value_cases DROP COLUMN IF EXISTS stage;
