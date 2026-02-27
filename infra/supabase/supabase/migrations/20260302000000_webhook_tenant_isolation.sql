-- Add tenant_id to webhook_events and webhook_dead_letter_queue for tenant isolation.
-- Existing rows get a NULL tenant_id; the application layer resolves tenant from
-- billing_customers.stripe_customer_id before inserting new rows.

-- 1. webhook_events: add tenant_id column
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Add next_retry_at column used by WebhookRetryService
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

-- Index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant_id
  ON public.webhook_events (tenant_id);

-- Composite index for retry queries scoped by tenant
CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant_retry
  ON public.webhook_events (tenant_id, processed, retry_count)
  WHERE processed = false;

-- 2. webhook_dead_letter_queue: create if not exists, with tenant_id
CREATE TABLE IF NOT EXISTS public.webhook_dead_letter_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  stripe_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  error_message text,
  retry_count integer DEFAULT 0,
  original_received_at timestamptz,
  moved_at timestamptz DEFAULT now()
);

-- If table already existed without tenant_id, add it
ALTER TABLE public.webhook_dead_letter_queue
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_tenant_id
  ON public.webhook_dead_letter_queue (tenant_id);

-- 3. RLS policies — service_role only (webhooks have no user session context)

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_dead_letter_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS webhook_events_service_role ON public.webhook_events;
  DROP POLICY IF EXISTS webhook_dlq_service_role ON public.webhook_dead_letter_queue;
END $$;

CREATE POLICY webhook_events_service_role ON public.webhook_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY webhook_dlq_service_role ON public.webhook_dead_letter_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Revoke access from anon and authenticated roles
REVOKE ALL ON public.webhook_events FROM anon, authenticated;
REVOKE ALL ON public.webhook_dead_letter_queue FROM anon, authenticated;

-- Grant only to service_role
GRANT ALL ON public.webhook_events TO service_role;
GRANT ALL ON public.webhook_dead_letter_queue TO service_role;
