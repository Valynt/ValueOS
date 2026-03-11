-- Operational hardening for compute_portfolio_value:
-- 1. Create security_events table for RPC-level access denial logging.
-- 2. Rewrite compute_portfolio_value to explicitly check tenant access and
--    insert a security_event row on denial rather than silently returning zeros.
--
-- Motivation: the original SECURITY DEFINER function returned zeros for any
-- unauthorized caller. Zeros are indistinguishable from a legitimate empty
-- portfolio, making probing attempts invisible in logs and metrics.

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 1. security_events — observable record of access denials and anomalies
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.security_events (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  text NOT NULL,          -- e.g. 'access_denied', 'quota_exceeded'
    resource    text NOT NULL,          -- e.g. 'compute_portfolio_value'
    actor_id    text,                   -- auth.uid() at time of event; null for anon
    tenant_id   text,                   -- requested tenant, may differ from actor's tenant
    detail      jsonb NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.security_events IS
    'Immutable log of security-relevant events (access denials, anomalies). '
    'Written by SECURITY DEFINER functions; never updated or deleted.';

-- Deny all direct DML from application roles — events are written only by
-- trusted SECURITY DEFINER functions.
REVOKE INSERT, UPDATE, DELETE ON public.security_events FROM PUBLIC;

-- Read access for service_role (monitoring, alerting) and authenticated users
-- scoped to their own actor_id.
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_events_service_read
    ON public.security_events
    FOR SELECT
    USING (current_setting('role', true) = 'service_role');

CREATE POLICY security_events_actor_read
    ON public.security_events
    FOR SELECT
    TO authenticated
    USING (actor_id = (auth.uid())::text);

-- Index for monitoring queries: recent denials by type, and per-tenant probing.
CREATE INDEX IF NOT EXISTS idx_security_events_type_created
    ON public.security_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_tenant_created
    ON public.security_events (tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Rewrite compute_portfolio_value
--
-- Changed from SQL to PL/pgSQL so we can:
--   a) Explicitly verify the caller has access to p_tenant_id via
--      security.user_has_tenant_access() before touching any data.
--   b) Insert a security_event row on denial so the attempt is observable
--      in logs, metrics, and alerting — not silently swallowed as zeros.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.compute_portfolio_value(p_tenant_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Explicit tenant access check. security.user_has_tenant_access() reads
    -- the JWT claim and returns false for any caller whose token does not
    -- include p_tenant_id in their tenant membership.
    IF NOT security.user_has_tenant_access(p_tenant_id) THEN
        -- Write an observable denial record. This runs under SECURITY DEFINER
        -- so it succeeds even though the caller has no INSERT on security_events.
        INSERT INTO public.security_events (
            event_type,
            resource,
            actor_id,
            tenant_id,
            detail
        ) VALUES (
            'access_denied',
            'compute_portfolio_value',
            (auth.uid())::text,
            p_tenant_id,
            jsonb_build_object(
                'requested_tenant', p_tenant_id,
                'caller_uid',       (auth.uid())::text,
                'ip',               current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
            )
        );

        -- Raise an error rather than returning zeros. The caller receives a
        -- structured error; the denial is now in security_events.
        RAISE EXCEPTION 'access_denied'
            USING ERRCODE = 'insufficient_privilege',
                  DETAIL  = 'Caller does not have access to tenant ' || p_tenant_id;
    END IF;

    SELECT json_build_object(
        'totalValue',    COALESCE(SUM(
                             CASE
                                 WHEN metadata->>'projected_value' IS NOT NULL
                                 THEN (metadata->>'projected_value')::NUMERIC
                                 ELSE 0
                             END
                         ), 0),
        'caseCount',     COUNT(*),
        'avgConfidence', COALESCE(AVG(quality_score), 0)
    )
    INTO v_result
    FROM public.value_cases
    WHERE tenant_id = p_tenant_id
      AND status != 'archived';

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.compute_portfolio_value(TEXT) IS
    'Compute portfolio value rollup for a tenant. '
    'Raises insufficient_privilege and writes a security_event row when the '
    'caller does not have access to the requested tenant. '
    'Used by the CasesPage portfolio header.';

-- Grant execute only to authenticated users (service_role inherits by default).
REVOKE EXECUTE ON FUNCTION public.compute_portfolio_value(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.compute_portfolio_value(TEXT) TO authenticated;
