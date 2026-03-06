-- Fix compute_portfolio_value: enforce caller membership before returning data.
--
-- The original function accepted an arbitrary p_tenant_id with no auth check,
-- allowing any authenticated user to read any tenant's portfolio by passing a
-- foreign tenant_id. This migration rewrites the function to verify the caller
-- is a member of the requested tenant via user_tenants before executing the
-- aggregate query, and restricts EXECUTE to the authenticated role only.

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.compute_portfolio_value(p_tenant_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id TEXT;
  v_result    JSON;
BEGIN
  -- Resolve the calling user from the JWT. Returns NULL for anonymous/service callers.
  v_caller_id := (auth.uid())::TEXT;

  -- Reject calls where the caller is not a member of the requested tenant.
  IF v_caller_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_tenants
    WHERE user_id  = v_caller_id
      AND tenant_id = p_tenant_id
  ) THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'totalValue',     COALESCE(SUM(
                        CASE
                          WHEN metadata->>'projected_value' IS NOT NULL
                          THEN (metadata->>'projected_value')::NUMERIC
                          ELSE 0
                        END
                      ), 0),
    'caseCount',      COUNT(*),
    'avgConfidence',  COALESCE(AVG(quality_score), 0)
  )
  INTO v_result
  FROM public.value_cases
  WHERE tenant_id = p_tenant_id
    AND status != 'archived';

  RETURN v_result;
END;
$$;

-- Restrict execution: revoke from PUBLIC, grant only to authenticated users.
REVOKE ALL ON FUNCTION public.compute_portfolio_value(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_portfolio_value(TEXT) TO authenticated;

COMMENT ON FUNCTION public.compute_portfolio_value(TEXT) IS
  'Portfolio value rollup for a tenant. Caller must be a member of the tenant '
  '(verified via user_tenants). Returns NULL for non-members. '
  'Used by the CasesPage portfolio header.';
