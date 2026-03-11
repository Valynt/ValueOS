-- ============================================================================
-- Patch compute_portfolio_value — fix cross-tenant data exposure
--
-- The original function accepted p_tenant_id from the caller and used
-- SECURITY DEFINER without verifying the caller is a member of that tenant.
-- Any authenticated user could read any tenant's portfolio by passing an
-- arbitrary tenant_id.
--
-- Fix:
--   1. Drop SECURITY DEFINER — function now runs as the calling user, so
--      value_cases RLS policies apply automatically.
--   2. Derive tenant scope from auth.uid() via user_tenants (the RLS
--      authority), ignoring the caller-supplied p_tenant_id entirely.
--   3. Lock search_path to prevent search_path injection.
--   4. Keep the same signature so existing callers do not break; the
--      p_tenant_id parameter is accepted but unused.
--
-- Rollback: 20260328000000_patch_compute_portfolio_value.rollback.sql
-- ============================================================================

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.compute_portfolio_value(p_tenant_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid;
  v_tenant_id text;
BEGIN
  -- Resolve the calling user from the JWT.
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'compute_portfolio_value: unauthenticated call'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Verify the caller is an active member of the requested tenant.
  -- user_tenants is the canonical RLS authority (security.user_has_tenant_access
  -- reads the same table). We do not trust the caller-supplied p_tenant_id
  -- beyond using it as a lookup key against the caller's own memberships.
  SELECT ut.tenant_id
    INTO v_tenant_id
    FROM public.user_tenants ut
   WHERE ut.user_id  = v_user_id::text
     AND ut.tenant_id = p_tenant_id
     AND (ut.status IS NULL OR ut.status = 'active')
   LIMIT 1;

  IF v_tenant_id IS NULL THEN
    -- Return an empty result rather than raising, so the UI degrades
    -- gracefully when a user has no access to the requested tenant.
    RETURN json_build_object(
      'totalValue',     0,
      'caseCount',      0,
      'avgConfidence',  0
    );
  END IF;

  -- Compute the rollup. RLS on value_cases provides a second layer of
  -- defence; the explicit tenant_id filter is retained for query efficiency.
  RETURN (
    SELECT json_build_object(
      'totalValue', COALESCE(SUM(
        CASE
          WHEN metadata->>'projected_value' IS NOT NULL
          THEN (metadata->>'projected_value')::NUMERIC
          ELSE 0
        END
      ), 0),
      'caseCount',     COUNT(*),
      'avgConfidence', COALESCE(AVG(quality_score), 0)
    )
    FROM public.value_cases
    WHERE tenant_id = v_tenant_id
      AND status   != 'archived'
  );
END;
$$;

COMMENT ON FUNCTION public.compute_portfolio_value(TEXT) IS
  'Portfolio value rollup for the authenticated user''s tenant. '
  'p_tenant_id is verified against the caller''s user_tenants membership '
  'before any data is returned. Returns zeros if the caller is not an '
  'active member of the requested tenant.';

-- Grant to authenticated only — service_role inherits superuser access.
GRANT EXECUTE ON FUNCTION public.compute_portfolio_value(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_portfolio_value(TEXT) FROM anon;
