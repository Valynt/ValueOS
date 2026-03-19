-- Remediation for Supabase linter errors:
--   0007 policy_exists_rls_disabled  — tables with policies but RLS not enabled
--   0013 rls_disabled_in_public      — public tables without RLS
--   0011 function_search_path_mutable — functions missing SET search_path
--
-- Root causes:
--   1. billing_customers, invoices, subscriptions, usage_aggregates, usage_events,
--      usage_quotas had policies created in 20260301000000_rls_service_role_audit
--      but the ENABLE ROW LEVEL SECURITY was silently skipped (table already had
--      the statement in a DO block that checked for existence, or the ALTER was
--      issued before the table existed in some environments).
--   2. tenants, subscription_items, usage_alerts, webhook_events,
--      tenant_provisioning_requests were never given ENABLE ROW LEVEL SECURITY.
--   3. Partition child tables (usage_ledger_p_*, rated_ledger_p_*,
--      saga_transitions_p_*, value_loop_events_p_*) and the three
--      security_audit_archive_* tables are in the public schema without RLS.
--      PostgreSQL does not automatically enable RLS on partition children when
--      the parent has it enabled; each child must be enabled explicitly.
--   4. Several trigger/utility functions were created without
--      SET search_path = public, pg_temp, leaving them vulnerable to
--      search_path injection.

SET search_path = public, pg_temp;

BEGIN;

-- ============================================================================
-- 1. Ensure RLS is enabled on tables that already have policies
--    (idempotent — ENABLE ROW LEVEL SECURITY is a no-op if already enabled)
-- ============================================================================

ALTER TABLE public.billing_customers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_aggregates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_quotas         ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Enable RLS on public tables that had no policies at all, then add
--    appropriate policies.
-- ============================================================================

-- tenants — service_role only; no direct authenticated access
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_service_role ON public.tenants;
CREATE POLICY tenants_service_role ON public.tenants
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users may read their own tenant row
DROP POLICY IF EXISTS tenants_member_select ON public.tenants;
CREATE POLICY tenants_member_select ON public.tenants
  FOR SELECT TO authenticated
  USING (security.user_has_tenant_access(id::text));

-- subscription_items — tenant-scoped read; service_role writes
ALTER TABLE public.subscription_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_items_tenant_select ON public.subscription_items;
CREATE POLICY subscription_items_tenant_select ON public.subscription_items
  FOR SELECT TO authenticated
  USING (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS subscription_items_service_role ON public.subscription_items;
CREATE POLICY subscription_items_service_role ON public.subscription_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.subscription_items TO authenticated;
GRANT ALL    ON public.subscription_items TO service_role;

-- usage_alerts — tenant-scoped read; service_role writes
ALTER TABLE public.usage_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usage_alerts_tenant_select ON public.usage_alerts;
CREATE POLICY usage_alerts_tenant_select ON public.usage_alerts
  FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS usage_alerts_service_role ON public.usage_alerts;
CREATE POLICY usage_alerts_service_role ON public.usage_alerts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.usage_alerts TO authenticated;
GRANT ALL    ON public.usage_alerts TO service_role;

-- webhook_events — service_role only (no user context for inbound webhooks)
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_events_service_role ON public.webhook_events;
CREATE POLICY webhook_events_service_role ON public.webhook_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.webhook_events TO service_role;
REVOKE ALL ON public.webhook_events FROM anon;
REVOKE ALL ON public.webhook_events FROM authenticated;

-- tenant_provisioning_requests — service_role only
ALTER TABLE public.tenant_provisioning_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_provisioning_requests_service_role ON public.tenant_provisioning_requests;
CREATE POLICY tenant_provisioning_requests_service_role ON public.tenant_provisioning_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.tenant_provisioning_requests TO service_role;

-- ============================================================================
-- 3. Enable RLS on partition child tables.
--
--    PostgreSQL inherits policies from the partitioned parent but does NOT
--    automatically enable RLS enforcement on child partitions. Each child
--    must have ENABLE ROW LEVEL SECURITY called explicitly so that the
--    inherited policies are actually enforced.
-- ============================================================================

-- usage_ledger partitions
ALTER TABLE public.usage_ledger_p_default  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_ledger_p_2026_04  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_ledger_p_2026_05  ENABLE ROW LEVEL SECURITY;

-- rated_ledger partitions
ALTER TABLE public.rated_ledger_p_default  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rated_ledger_p_2026_04  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rated_ledger_p_2026_05  ENABLE ROW LEVEL SECURITY;

-- saga_transitions partitions
ALTER TABLE public.saga_transitions_p_default  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saga_transitions_p_2026_04  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saga_transitions_p_2026_05  ENABLE ROW LEVEL SECURITY;

-- value_loop_events partitions
ALTER TABLE public.value_loop_events_p_default  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.value_loop_events_p_2026_04  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.value_loop_events_p_2026_05  ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Enable RLS on security_audit_archive_* tables.
--    These are internal audit tables; only service_role should access them.
-- ============================================================================

ALTER TABLE public.security_audit_archive_batch    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_archive_segment  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_archive_alert    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_audit_archive_batch_service_role   ON public.security_audit_archive_batch;
DROP POLICY IF EXISTS security_audit_archive_segment_service_role ON public.security_audit_archive_segment;
DROP POLICY IF EXISTS security_audit_archive_alert_service_role   ON public.security_audit_archive_alert;

CREATE POLICY security_audit_archive_batch_service_role ON public.security_audit_archive_batch
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY security_audit_archive_segment_service_role ON public.security_audit_archive_segment
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY security_audit_archive_alert_service_role ON public.security_audit_archive_alert
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.security_audit_archive_batch    TO service_role;
GRANT ALL ON public.security_audit_archive_segment  TO service_role;
GRANT ALL ON public.security_audit_archive_alert    TO service_role;

-- ============================================================================
-- 5. Fix mutable search_path on functions.
--
--    Each function is re-created with SET search_path = public, pg_temp added.
--    Signatures and bodies are unchanged; only the configuration parameter
--    is added. Using CREATE OR REPLACE so existing triggers remain valid.
-- ============================================================================

-- public.set_psc_updated_at
CREATE OR REPLACE FUNCTION public.set_psc_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- public.set_workflow_states_updated_at
CREATE OR REPLACE FUNCTION public.set_workflow_states_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- public.set_updated_at  (used by case_artifacts and kpi_dependencies triggers)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- public.update_updated_at_column  (generic trigger used across many tables)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- public.current_tenant_id
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
$$;

-- public.prevent_compliance_control_mutation
CREATE OR REPLACE FUNCTION public.prevent_compliance_control_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'compliance_controls rows are immutable after creation';
END;
$$;

-- public.get_refresh_token_status
CREATE OR REPLACE FUNCTION public.get_refresh_token_status(
  current_refresh_token_fingerprint  text,
  previous_refresh_token_fingerprint text DEFAULT NULL,
  auth_event                         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN jsonb_build_object(
    'trusted',         true,
    'replayDetected',  false,
    'revoked',         false
  );
END;
$$;

-- public.rotate_security_audit_logs
CREATE OR REPLACE FUNCTION public.rotate_security_audit_logs(
  retention_policy JSONB DEFAULT '{"policy_version":"legacy-180d","operational_window_days":180,"archive_years":7}'::jsonb,
  max_rows         INTEGER DEFAULT 5000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
      batch_id,
      source_id,
      event_timestamp,
      payload,
      checksum_sha256,
      chain_prev_checksum_sha256,
      chain_checksum_sha256
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
    'batch_id',                 batch_id,
    'policy_version',           policy_version,
    'operational_window_days',  operational_window_days,
    'archive_years',            archive_years,
    'rows_moved',               moved_count,
    'status',                   CASE WHEN moved_count = 0 THEN 'noop' ELSE 'staged' END
  );
END;
$$;

-- public.verify_security_audit_archive_integrity
CREATE OR REPLACE FUNCTION public.verify_security_audit_archive_integrity(
  lookback_days INTEGER DEFAULT 45
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  bad_checksum_count    INTEGER := 0;
  missing_export_count  INTEGER := 0;
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

-- security.jwt_has_scope
CREATE OR REPLACE FUNCTION security.jwt_has_scope(required_scope TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = security, public, pg_temp
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' -> 'permissions') ? required_scope
    OR (auth.jwt() -> 'permissions') ? required_scope,
    false
  );
$$;

-- security.user_has_tenant_access (text overload)
CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, security, pg_temp
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

-- security.user_has_tenant_access (uuid overload)
CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, security, pg_temp
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

-- ============================================================================
-- 6. Patch create_next_monthly_partitions to enable RLS on new partitions.
--
--    The existing function creates partition children but does not call
--    ENABLE ROW LEVEL SECURITY on them, causing every newly created partition
--    to appear in the linter. The patched version adds that call after each
--    CREATE TABLE … PARTITION OF.
-- ============================================================================

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
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p1_name);
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
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p2_name);
    END IF;
  END LOOP;
END;
$$;

COMMIT;
