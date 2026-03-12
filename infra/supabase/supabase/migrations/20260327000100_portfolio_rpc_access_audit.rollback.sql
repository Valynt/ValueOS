-- Rollback: restore compute_portfolio_value to original SQL form,
-- drop security_events table and its indexes.

SET search_path = public, pg_temp;

DROP INDEX IF EXISTS public.idx_security_events_tenant_created;
DROP INDEX IF EXISTS public.idx_security_events_type_created;
DROP TABLE IF EXISTS public.security_events;

-- Restore original SQL function (returns zeros on unauthorized access).
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
