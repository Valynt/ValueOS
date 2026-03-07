-- ============================================================================
-- ROLLBACK: 20260302000000_webhook_tenant_isolation
-- Drops the webhook_dead_letter_queue table, removes the tenant_id column
-- and index added to webhook_events, and drops the RLS policies.
-- ⚠️  All dead-letter queue data will be lost.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

DROP POLICY IF EXISTS webhook_events_service_role ON public.webhook_events;
DROP POLICY IF EXISTS webhook_dlq_service_role ON public.webhook_dead_letter_queue;

DROP TABLE IF EXISTS public.webhook_dead_letter_queue CASCADE;

DROP INDEX IF EXISTS public.idx_webhook_events_tenant_retry;
DROP INDEX IF EXISTS public.idx_webhook_events_tenant_id;

ALTER TABLE public.webhook_events
    DROP COLUMN IF EXISTS tenant_id,
    DROP COLUMN IF EXISTS retry_count;
