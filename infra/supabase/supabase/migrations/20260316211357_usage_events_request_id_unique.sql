-- ============================================================================
-- Migration: Add UNIQUE (tenant_id, request_id) to usage_events
-- Purpose:   Enforce DB-level deduplication on request_id per tenant.
--            Without this constraint, duplicate usage events with the same
--            request_id can be inserted, leading to double-charging.
--            The idempotency_key index (tenant_id, idempotency_key) already
--            covers the derived SHA-256 key path; this constraint covers the
--            raw request_id path used by the billing ingestion layer.
-- Depends:   20260304060000_usage_events_evidence_constraints.sql
--            (adds NOT NULL check on request_id for new rows)
-- ============================================================================

SET search_path = public, pg_temp;

-- Add the unique index as a partial index so that legacy NULL request_id rows
-- (pre-constraint era) are excluded and the migration does not fail on
-- existing data.
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_events_tenant_request_id_unique
  ON public.usage_events (tenant_id, request_id)
  WHERE request_id IS NOT NULL;

COMMENT ON INDEX public.idx_usage_events_tenant_request_id_unique IS
  'Prevents duplicate billing events for the same (tenant, request_id) pair. '
  'Partial index excludes legacy NULL request_id rows.';
