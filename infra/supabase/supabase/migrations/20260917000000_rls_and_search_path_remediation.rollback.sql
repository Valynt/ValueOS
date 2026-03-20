-- Rollback: 20260917000000_rls_and_search_path_remediation.sql
--
-- Removes the RLS policies added for tables that had none, and reverts
-- functions to their pre-remediation definitions (without SET search_path).
-- DISABLE ROW LEVEL SECURITY is used rather than DROP to restore the original
-- (RLS-disabled) state during a partial rollback window, increasing exposure
-- compared to keeping RLS enabled.
--
-- NOTE: ENABLE ROW LEVEL SECURITY on tables that already had it
-- (billing_customers, invoices, subscriptions, usage_aggregates, usage_events,
-- usage_quotas, and all partition children) is not reversed here because those
-- tables had RLS enabled in earlier migrations; disabling it would regress
-- security further than the original state.

SET search_path = public, pg_temp;

BEGIN;

-- ============================================================================
-- 1. Remove policies and disable RLS on tables newly protected in this migration
-- ============================================================================

-- tenants
DROP POLICY IF EXISTS tenants_service_role   ON public.tenants;
DROP POLICY IF EXISTS tenants_member_select  ON public.tenants;
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;

-- subscription_items
DROP POLICY IF EXISTS subscription_items_tenant_select  ON public.subscription_items;
DROP POLICY IF EXISTS subscription_items_service_role   ON public.subscription_items;
ALTER TABLE public.subscription_items DISABLE ROW LEVEL SECURITY;

-- usage_alerts
DROP POLICY IF EXISTS usage_alerts_tenant_select  ON public.usage_alerts;
DROP POLICY IF EXISTS usage_alerts_service_role   ON public.usage_alerts;
ALTER TABLE public.usage_alerts DISABLE ROW LEVEL SECURITY;

-- webhook_events
DROP POLICY IF EXISTS webhook_events_service_role ON public.webhook_events;
ALTER TABLE public.webhook_events DISABLE ROW LEVEL SECURITY;

-- tenant_provisioning_requests
DROP POLICY IF EXISTS tenant_provisioning_requests_service_role ON public.tenant_provisioning_requests;
ALTER TABLE public.tenant_provisioning_requests DISABLE ROW LEVEL SECURITY;

-- security_audit_archive_* tables
DROP POLICY IF EXISTS security_audit_archive_batch_service_role   ON public.security_audit_archive_batch;
DROP POLICY IF EXISTS security_audit_archive_segment_service_role ON public.security_audit_archive_segment;
DROP POLICY IF EXISTS security_audit_archive_alert_service_role   ON public.security_audit_archive_alert;
ALTER TABLE public.security_audit_archive_batch    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_archive_segment  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_archive_alert    DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Revert functions to pre-remediation definitions (no SET search_path)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_psc_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_workflow_states_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
$$;

CREATE OR REPLACE FUNCTION public.prevent_compliance_control_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'compliance_controls rows are immutable after creation';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_refresh_token_status(
  current_refresh_token_fingerprint  text,
  previous_refresh_token_fingerprint text DEFAULT NULL,
  auth_event                         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'trusted',        true,
    'replayDetected', false,
    'revoked',        false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_security_audit_logs(
  retention_policy JSONB DEFAULT '{"policy_version":"legacy-180d","operational_window_days":180,"archive_years":7}'::jsonb,
  max_rows         INTEGER DEFAULT 5000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  policy_version          TEXT        := COALESCE(retention_policy->>'policy_version', 'legacy-180d');
  operational_window_days INTEGER     := COALESCE((retention_policy->>'operational_window_days')::INTEGER, 180);
  archive_years           INTEGER     := COALESCE((retention_policy->>'archive_years')::INTEGER, 7);
  archive_retain_until    TIMESTAMPTZ := NOW() + make_interval(years => archive_years);
  batch_id                UUID;
  moved_count             INTEGER     := 0;
BEGIN
  INSERT INTO public.security_audit_archive_batch (
    retention_policy_version,
    operational_window_days,
    archive_retain_until
  ) VALUES (
    policy_version,
    operational_window_days,
    archive_retain_until
  )
  RETURNING id INTO batch_id;

  WITH candidates AS (
    SELECT ctid, to_jsonb(s) AS payload
    FROM public.security_audit_log AS s
    WHERE COALESCE(
      NULLIF(to_jsonb(s)->>'timestamp', '')::timestamptz,
      NULLIF(to_jsonb(s)->>'created_at', '')::timestamptz,
      NOW()
    ) < NOW() - make_interval(days => operational_window_days)
    ORDER BY COALESCE(
      NULLIF(to_jsonb(s)->>'timestamp', '')::timestamptz,
      NULLIF(to_jsonb(s)->>'created_at', '')::timestamptz,
      NOW()
    )
    LIMIT GREATEST(max_rows, 1)
  ), archived AS (
    INSERT INTO public.security_audit_archive_segment (
      batch_id, source_id, event_timestamp, payload,
      checksum_sha256, chain_prev_checksum_sha256, chain_checksum_sha256
    )
    SELECT
      batch_id,
      COALESCE(payload->>'id', encode(digest(payload::text, 'sha256'), 'hex')),
      COALESCE(
        NULLIF(payload->>'timestamp', '')::timestamptz,
        NULLIF(payload->>'created_at', '')::timestamptz,
        NOW()
      ),
      payload,
      encode(digest(payload::text, 'sha256'), 'hex'),
      lag(encode(digest(payload::text, 'sha256'), 'hex')) OVER (
        ORDER BY COALESCE(NULLIF(payload->>'timestamp', '')::timestamptz, NULLIF(payload->>'created_at', '')::timestamptz, NOW())
      ),
      encode(
        digest(
          COALESCE(
            lag(encode(digest(payload::text, 'sha256'), 'hex')) OVER (
              ORDER BY COALESCE(NULLIF(payload->>'timestamp', '')::timestamptz, NULLIF(payload->>'created_at', '')::timestamptz, NOW())
            ),
            ''
          ) || ':' || encode(digest(payload::text, 'sha256'), 'hex'),
          'sha256'
        ),
        'hex'
      )
    FROM candidates
    RETURNING source_id
  ), deleted AS (
    DELETE FROM public.security_audit_log AS s
    USING candidates
    WHERE s.ctid = candidates.ctid
    RETURNING 1
  )
  SELECT COUNT(*) INTO moved_count FROM deleted;

  UPDATE public.security_audit_archive_batch
  SET status = CASE WHEN moved_count = 0 THEN 'noop' ELSE 'staged' END
  WHERE id = batch_id;

  RETURN jsonb_build_object(
    'batch_id', batch_id,
    'policy_version', policy_version,
    'operational_window_days', operational_window_days,
    'archive_years', archive_years,
    'rows_moved', moved_count,
    'status', CASE WHEN moved_count = 0 THEN 'noop' ELSE 'staged' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_security_audit_archive_integrity(
  lookback_days INTEGER DEFAULT 45
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bad_checksum_count   INTEGER := 0;
  missing_export_count INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO bad_checksum_count
  FROM public.security_audit_archive_segment s
  WHERE s.archived_at >= NOW() - make_interval(days => lookback_days)
    AND s.checksum_sha256 <> encode(digest(s.payload::text, 'sha256'), 'hex');

  SELECT COUNT(*) INTO missing_export_count
  FROM public.security_audit_archive_batch b
  WHERE b.created_at >= NOW() - make_interval(days => lookback_days)
    AND b.status IN ('staged', 'exported')
    AND (b.object_store_uri IS NULL OR b.export_checksum_sha256 IS NULL);

  IF bad_checksum_count > 0 OR missing_export_count > 0 THEN
    INSERT INTO public.security_audit_archive_alert (severity, code, details)
    VALUES (
      'critical',
      'archive_integrity_mismatch',
      jsonb_build_object(
        'bad_checksum_count',   bad_checksum_count,
        'missing_export_count', missing_export_count,
        'lookback_days',        lookback_days
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'status',               CASE WHEN bad_checksum_count = 0 AND missing_export_count = 0 THEN 'ok' ELSE 'alert' END,
    'bad_checksum_count',   bad_checksum_count,
    'missing_export_count', missing_export_count,
    'lookback_days',        lookback_days
  );
END;
$$;

-- Restore security functions without SET search_path
CREATE OR REPLACE FUNCTION security.jwt_has_scope(required_scope TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' -> 'permissions') ? required_scope
    OR (auth.jwt() -> 'permissions') ? required_scope,
    false
  );
$$;

CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id  = auth.uid()::text
      AND tenant_id = target_tenant_id
      AND status    = 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_tenants
    WHERE user_id  = auth.uid()::text
      AND tenant_id = target_tenant_id::text
      AND status    = 'active'
  );
END;
$$;

-- Restore create_next_monthly_partitions without ENABLE ROW LEVEL SECURITY call
CREATE OR REPLACE FUNCTION public.create_next_monthly_partitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  tables   text[] := ARRAY[
    'usage_ledger', 'rated_ledger', 'saga_transitions', 'value_loop_events'
  ];
  tbl      text;
  m1_start timestamptz := date_trunc('month', now() + interval '1 month');
  m1_end   timestamptz := m1_start + interval '1 month';
  m2_start timestamptz := m1_end;
  m2_end   timestamptz := m2_start + interval '1 month';
  p1_name  text;
  p2_name  text;
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    p1_name := tbl || '_p_' || to_char(m1_start, 'YYYY_MM');
    p2_name := tbl || '_p_' || to_char(m2_start, 'YYYY_MM');

    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = p1_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
        p1_name, tbl, m1_start, m1_end
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = p2_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
        p2_name, tbl, m2_start, m2_end
      );
    END IF;
  END LOOP;
END;
$$;

COMMIT;
