-- ============================================================================
-- CRM Enterprise Hardening Migration
--
-- Addresses: data isolation, out-of-order protection, token key versioning,
-- provenance correlation, webhook retention, append-only audit enforcement,
-- and sync health observability.
-- ============================================================================

-- ============================================================================
-- 1. crm_connections: token key versioning + rotation tracking
-- ============================================================================

ALTER TABLE public.crm_connections
    ADD COLUMN IF NOT EXISTS token_key_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS token_last_rotated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS token_fingerprint TEXT;

COMMENT ON COLUMN public.crm_connections.token_key_version IS 'Encryption key version used for current tokens. Increment on key rotation.';
COMMENT ON COLUMN public.crm_connections.token_fingerprint IS 'SHA-256 hash prefix of the access token for detection without storing plaintext.';

-- ============================================================================
-- 2. opportunities: out-of-order protection columns
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'opportunities' AND column_name = 'external_last_modified_at') THEN
        ALTER TABLE public.opportunities
            ADD COLUMN external_last_modified_at TIMESTAMPTZ,
            ADD COLUMN crm_sync_hash TEXT;
    END IF;
END $$;

COMMENT ON COLUMN public.opportunities.external_last_modified_at IS 'CRM-side LastModifiedDate. Used for compare-and-set to reject stale updates.';
COMMENT ON COLUMN public.opportunities.crm_sync_hash IS 'SHA-256 of canonical CRM fields. Skip provenance writes when unchanged.';

-- ============================================================================
-- 3. Foreign keys: webhook events and object maps → connections
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_webhook_events_connection_fk') THEN
        -- FK uses (tenant_id, provider) since that's the unique key on crm_connections
        ALTER TABLE public.crm_webhook_events
            ADD CONSTRAINT crm_webhook_events_connection_fk
            FOREIGN KEY (tenant_id, provider)
            REFERENCES public.crm_connections (tenant_id, provider)
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_object_maps_connection_fk') THEN
        ALTER TABLE public.crm_object_maps
            ADD CONSTRAINT crm_object_maps_connection_fk
            FOREIGN KEY (tenant_id, provider)
            REFERENCES public.crm_connections (tenant_id, provider)
            ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- 4. provenance_records: add ingestion_method and correlation_id
-- ============================================================================

ALTER TABLE public.provenance_records
    ADD COLUMN IF NOT EXISTS ingestion_method TEXT DEFAULT 'delta_sync',
    ADD COLUMN IF NOT EXISTS correlation_id TEXT,
    ADD COLUMN IF NOT EXISTS job_id TEXT;

COMMENT ON COLUMN public.provenance_records.ingestion_method IS 'How data was ingested: delta_sync, webhook, manual, agent_prefetch.';
COMMENT ON COLUMN public.provenance_records.correlation_id IS 'Request/trace ID for end-to-end tracing.';

ALTER TABLE public.provenance_records
    DROP CONSTRAINT IF EXISTS provenance_records_ingestion_method_check;
ALTER TABLE public.provenance_records
    ADD CONSTRAINT provenance_records_ingestion_method_check
    CHECK (ingestion_method IN ('delta_sync', 'webhook', 'manual', 'agent_prefetch'));

-- ============================================================================
-- 5. Webhook event retention: add expires_at for TTL-based cleanup
-- ============================================================================

ALTER TABLE public.crm_webhook_events
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + interval '90 days');

CREATE INDEX IF NOT EXISTS idx_crm_webhook_events_expires
    ON public.crm_webhook_events (expires_at)
    WHERE process_status IN ('processed', 'failed');

-- Retention cleanup function (call via pg_cron or application scheduler)
CREATE OR REPLACE FUNCTION public.crm_webhook_events_cleanup()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.crm_webhook_events
    WHERE expires_at < now()
      AND process_status IN ('processed', 'failed');
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- ============================================================================
-- 6. Append-only enforcement for provenance_records
-- ============================================================================

CREATE OR REPLACE FUNCTION public.provenance_records_deny_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'provenance_records is append-only. Updates and deletes are prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS provenance_records_no_update ON public.provenance_records;
CREATE TRIGGER provenance_records_no_update
    BEFORE UPDATE ON public.provenance_records
    FOR EACH ROW
    EXECUTE FUNCTION public.provenance_records_deny_mutation();

DROP TRIGGER IF EXISTS provenance_records_no_delete ON public.provenance_records;
CREATE TRIGGER provenance_records_no_delete
    BEFORE DELETE ON public.provenance_records
    FOR EACH ROW
    EXECUTE FUNCTION public.provenance_records_deny_mutation();

-- ============================================================================
-- 7. Sync health view for observability
-- ============================================================================

CREATE OR REPLACE VIEW public.crm_sync_health AS
SELECT
    c.tenant_id,
    c.provider,
    c.status,
    c.last_sync_at,
    c.last_successful_sync_at,
    EXTRACT(EPOCH FROM (now() - c.last_successful_sync_at))::INTEGER AS sync_lag_seconds,
    c.last_error,
    c.token_expires_at,
    CASE
        WHEN c.token_expires_at < now() THEN 'expired'
        WHEN c.token_expires_at < now() + interval '1 hour' THEN 'expiring_soon'
        ELSE 'valid'
    END AS token_health,
    (
        SELECT COUNT(*)
        FROM public.crm_webhook_events e
        WHERE e.tenant_id = c.tenant_id
          AND e.provider = c.provider
          AND e.process_status = 'failed'
          AND e.received_at > now() - interval '1 hour'
    )::INTEGER AS error_rate_1h,
    (
        SELECT COUNT(*)
        FROM public.crm_webhook_events e
        WHERE e.tenant_id = c.tenant_id
          AND e.provider = c.provider
          AND e.received_at > now() - interval '1 hour'
    )::INTEGER AS webhook_throughput_1h
FROM public.crm_connections c
WHERE c.status != 'disconnected';

COMMENT ON VIEW public.crm_sync_health IS 'Per-tenant CRM sync health: lag, error rates, token status.';

-- ============================================================================
-- 8. Index for out-of-order protection queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_opportunities_external_modified
    ON public.opportunities (external_crm_id, external_last_modified_at)
    WHERE external_crm_id IS NOT NULL;
