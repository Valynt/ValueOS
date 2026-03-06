-- Rollback: 20260302000000_webhook_tenant_isolation
-- Drops the dead-letter queue table and removes the tenant_id column added to webhook_events.
DROP TABLE IF EXISTS public.webhook_dead_letter_queue CASCADE;
ALTER TABLE public.webhook_events
  DROP COLUMN IF EXISTS tenant_id,
  DISABLE ROW LEVEL SECURITY;
