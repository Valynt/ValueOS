-- ============================================================================
-- Rollback: Remove UNIQUE (tenant_id, request_id) index from usage_events
-- Reverts:  20260316211357_usage_events_request_id_unique.sql
-- ============================================================================

SET search_path = public, pg_temp;

DROP INDEX IF EXISTS public.idx_usage_events_tenant_request_id_unique;
