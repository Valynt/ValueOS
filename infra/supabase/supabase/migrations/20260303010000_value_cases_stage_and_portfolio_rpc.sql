-- Add stage column to value_cases for 7-stage navigation tracking,
-- and create compute_portfolio_value RPC for portfolio rollup.

SET search_path = public, pg_temp;

-- 1. Add stage column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'value_cases'
      AND column_name = 'stage'
  ) THEN
    ALTER TABLE public.value_cases
      ADD COLUMN stage TEXT DEFAULT 'discovery';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_value_cases_stage
  ON public.value_cases(stage);

-- 2. Portfolio value RPC
-- Returns aggregate metrics for a tenant's non-archived cases.
-- Uses SECURITY DEFINER so the function runs with the definer's privileges,
-- but the WHERE clause enforces tenant scoping.
CREATE OR REPLACE FUNCTION public.compute_portfolio_value(p_tenant_id TEXT)
RETURNS JSON AS $$
  SELECT json_build_object(
    'totalValue', COALESCE(SUM(
      CASE
        WHEN metadata->>'projected_value' IS NOT NULL
        THEN (metadata->>'projected_value')::NUMERIC
        ELSE 0
      END
    ), 0),
    'caseCount', COUNT(*),
    'avgConfidence', COALESCE(AVG(quality_score), 0)
  )
  FROM public.value_cases
  WHERE tenant_id = p_tenant_id
    AND status != 'archived';
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.compute_portfolio_value(TEXT)
  IS 'Compute portfolio value rollup for a tenant. Used by the CasesPage portfolio header.';
