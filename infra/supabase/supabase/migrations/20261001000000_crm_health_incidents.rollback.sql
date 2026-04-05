SET search_path = public, pg_temp;

CREATE OR REPLACE VIEW public.crm_sync_health AS
SELECT
    c.tenant_id,
    c.provider,
    c.status,
    c.last_sync_at,
    c.last_successful_sync_at,
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
    (
      SELECT COUNT(*)::integer
      FROM public.crm_webhook_events e
      WHERE e.tenant_id = c.tenant_id
        AND e.provider = c.provider
        AND e.received_at > now() - interval '1 hour'
        AND e.process_status = 'failed'
    ) AS error_rate_1h,
    (
      SELECT COUNT(*)::integer
      FROM public.crm_webhook_events e
      WHERE e.tenant_id = c.tenant_id
        AND e.provider = c.provider
        AND e.received_at > now() - interval '1 hour'
    ) AS webhook_throughput_1h
FROM public.crm_connections c;

DROP TABLE IF EXISTS public.crm_health_incidents;
