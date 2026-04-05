SET search_path = public, pg_temp;

-- rls-classification: tenant_scoped
CREATE TABLE IF NOT EXISTS public.crm_health_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  reason_code text NOT NULL,
  summary text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  duration_seconds integer GENERATED ALWAYS AS (
    CASE
      WHEN resolved_at IS NULL THEN NULL
      ELSE GREATEST(0, floor(EXTRACT(EPOCH FROM (resolved_at - started_at)))::integer)
    END
  ) STORED,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_health_incidents_provider_check CHECK (provider IN ('salesforce', 'hubspot')),
  CONSTRAINT crm_health_incidents_severity_check CHECK (severity IN ('warning', 'critical')),
  CONSTRAINT crm_health_incidents_time_check CHECK (resolved_at IS NULL OR resolved_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_crm_health_incidents_tenant_provider_started
  ON public.crm_health_incidents (tenant_id, provider, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_health_incidents_unresolved
  ON public.crm_health_incidents (tenant_id, provider)
  WHERE resolved_at IS NULL;

ALTER TABLE public.crm_health_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_health_incidents_tenant_select ON public.crm_health_incidents;
CREATE POLICY crm_health_incidents_tenant_select ON public.crm_health_incidents
  FOR SELECT USING (security.user_has_tenant_access(tenant_id::text));

DROP POLICY IF EXISTS crm_health_incidents_tenant_insert ON public.crm_health_incidents;
CREATE POLICY crm_health_incidents_tenant_insert ON public.crm_health_incidents
  FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id::text));

DROP POLICY IF EXISTS crm_health_incidents_tenant_update ON public.crm_health_incidents;
CREATE POLICY crm_health_incidents_tenant_update ON public.crm_health_incidents
  FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id::text))
  WITH CHECK (security.user_has_tenant_access(tenant_id::text));

DROP POLICY IF EXISTS crm_health_incidents_tenant_delete ON public.crm_health_incidents;
CREATE POLICY crm_health_incidents_tenant_delete ON public.crm_health_incidents
  FOR DELETE USING (security.user_has_tenant_access(tenant_id::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_health_incidents TO authenticated;
GRANT ALL ON public.crm_health_incidents TO service_role;

COMMENT ON TABLE public.crm_health_incidents IS
  'CRM integration incident windows used for timeline visualization and MTTR calculation.';

CREATE OR REPLACE VIEW public.crm_sync_health AS
WITH recent_webhook_metrics AS (
  SELECT
    e.tenant_id,
    e.provider,
    COUNT(*) FILTER (WHERE e.received_at > now() - interval '1 hour')::integer AS webhook_throughput_1h,
    COUNT(*) FILTER (
      WHERE e.received_at > now() - interval '1 hour'
        AND e.process_status = 'failed'
    )::integer AS error_rate_1h,
    MAX(e.received_at) FILTER (WHERE e.process_status = 'processed') AS last_successful_webhook_at,
    MAX(e.processed_at) FILTER (WHERE e.process_status = 'processed') AS last_successful_process_at,
    MAX(e.received_at) FILTER (WHERE e.process_status = 'processed') AS last_processed_received_at
  FROM public.crm_webhook_events e
  GROUP BY e.tenant_id, e.provider
),
consecutive_failures AS (
  SELECT
    e.tenant_id,
    e.provider,
    COUNT(*)::integer AS consecutive_failure_count
  FROM public.crm_webhook_events e
  LEFT JOIN recent_webhook_metrics m
    ON m.tenant_id = e.tenant_id
   AND m.provider = e.provider
  WHERE e.process_status = 'failed'
    AND e.received_at > COALESCE(m.last_processed_received_at, '-infinity'::timestamptz)
  GROUP BY e.tenant_id, e.provider
),
mttr AS (
  SELECT
    i.tenant_id,
    i.provider,
    ROUND(AVG(i.duration_seconds))::integer AS mttr_seconds,
    COUNT(*)::integer AS mttr_sample_size
  FROM public.crm_health_incidents i
  WHERE i.resolved_at IS NOT NULL
  GROUP BY i.tenant_id, i.provider
)
SELECT
  c.tenant_id,
  c.provider,
  CASE
    WHEN c.status IN ('error', 'expired', 'disconnected') THEN c.status
    WHEN COALESCE(f.consecutive_failure_count, 0) >= 5
      OR COALESCE(m.error_rate_1h, 0) >= 20
      OR COALESCE(EXTRACT(EPOCH FROM now() - c.last_sync_at)::integer, 0) >= 14400
      OR (c.token_expires_at IS NOT NULL AND c.token_expires_at <= now())
      THEN 'error'
    WHEN COALESCE(f.consecutive_failure_count, 0) >= 3
      OR COALESCE(m.error_rate_1h, 0) >= 5
      OR COALESCE(EXTRACT(EPOCH FROM now() - c.last_sync_at)::integer, 0) >= 3600
      OR (c.token_expires_at IS NOT NULL AND c.token_expires_at <= now() + interval '1 hour')
      THEN 'degraded'
    ELSE 'connected'
  END AS status,
  (
    (COALESCE(f.consecutive_failure_count, 0) >= 3)
    OR (COALESCE(m.error_rate_1h, 0) >= 5)
    OR (COALESCE(EXTRACT(EPOCH FROM now() - c.last_sync_at)::integer, 0) >= 3600)
  ) AS degraded,
  c.last_sync_at,
  c.last_successful_sync_at,
  m.last_successful_webhook_at,
  m.last_successful_process_at,
  CASE
    WHEN c.last_sync_at IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM now() - c.last_sync_at)::integer
  END AS sync_lag_seconds,
  CASE
    WHEN c.token_expires_at IS NULL THEN 'valid'
    WHEN c.token_expires_at <= now() THEN 'expired'
    WHEN c.token_expires_at <= now() + interval '1 hour' THEN 'expiring_soon'
    ELSE 'valid'
  END AS token_health,
  COALESCE(m.error_rate_1h, 0) AS error_rate_1h,
  COALESCE(m.webhook_throughput_1h, 0) AS webhook_throughput_1h,
  COALESCE(f.consecutive_failure_count, 0) AS consecutive_failure_count,
  mt.mttr_seconds,
  COALESCE(mt.mttr_sample_size, 0) AS mttr_sample_size
FROM public.crm_connections c
LEFT JOIN recent_webhook_metrics m
  ON m.tenant_id = c.tenant_id
 AND m.provider = c.provider
LEFT JOIN consecutive_failures f
  ON f.tenant_id = c.tenant_id
 AND f.provider = c.provider
LEFT JOIN mttr mt
  ON mt.tenant_id = c.tenant_id
 AND mt.provider = c.provider;

COMMENT ON VIEW public.crm_sync_health IS
  'Per-tenant CRM sync health, degraded state, failure streak, and recovery metrics.';
