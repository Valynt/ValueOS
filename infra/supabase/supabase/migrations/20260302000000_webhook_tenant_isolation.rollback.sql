-- Rollback: 20260302000000_webhook_tenant_isolation
-- Removes tenant_id columns and related indexes from webhook tables.

BEGIN;

DROP INDEX IF EXISTS public.idx_webhook_dlq_tenant_id;
DROP INDEX IF EXISTS public.idx_webhook_events_tenant_retry;
DROP INDEX IF EXISTS public.idx_webhook_events_tenant_id;

ALTER TABLE public.webhook_dead_letter_queue
  DROP COLUMN IF EXISTS tenant_id;

ALTER TABLE public.webhook_events
  DROP COLUMN IF EXISTS next_retry_at,
  DROP COLUMN IF EXISTS tenant_id;

COMMIT;
