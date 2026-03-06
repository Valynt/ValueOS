-- Rollback: restore compute_portfolio_value to pre-hardening state.
-- WARNING: this removes the membership check — only apply during an emergency
-- rollback and re-apply the fix migration as soon as possible.

SET search_path = public, pg_temp;

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

-- Restore original (permissive) grants
GRANT EXECUTE ON FUNCTION public.compute_portfolio_value(TEXT) TO PUBLIC;
