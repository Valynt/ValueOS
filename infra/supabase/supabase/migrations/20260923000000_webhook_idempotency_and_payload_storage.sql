-- Webhook idempotency hardening and durable payload storage.
--
-- Changes:
--   1. Ensure DB-level UNIQUE constraint on stripe_event_id (idempotent — already
--      present in the canonical schema snapshot, but may be absent on instances
--      that applied 20260302000000 before the baseline constraint was added).
--   2. Add status column: pending | processing | processed | failed | duplicate.
--      Replaces the boolean `processed` flag for richer state tracking.
--   3. Add failed_at column: timestamp when the event was permanently failed.
--   4. Add raw_payload column: stores the raw Stripe event JSON for payloads ≤256kb.
--   5. Add payload_ref column: Supabase Storage object path for payloads >256kb.
--   6. Backfill status from existing processed/error_message columns.
--
-- Idempotent: all ALTER TABLE statements use IF NOT EXISTS / DO NOTHING patterns.

BEGIN;

SET LOCAL search_path = public, pg_temp;

-- ── 1. Ensure UNIQUE constraint on stripe_event_id ────────────────────────────
-- The canonical baseline has this constraint. This block is a safety net for
-- instances where the constraint was dropped or never applied.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'webhook_events_stripe_event_id_key'
      AND conrelid = 'public.webhook_events'::regclass
  ) THEN
    ALTER TABLE public.webhook_events
      ADD CONSTRAINT webhook_events_stripe_event_id_key UNIQUE (stripe_event_id);
  END IF;
END $$;

-- ── 2. Add status column ──────────────────────────────────────────────────────
-- Values: pending | processing | processed | failed | duplicate
-- Default 'pending' for new rows; backfilled below for existing rows.

ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'duplicate'));

-- ── 3. Add failed_at column ───────────────────────────────────────────────────

ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS failed_at timestamptz;

-- ── 4. Add raw_payload column ─────────────────────────────────────────────────
-- Stores the raw Stripe event JSON for payloads ≤256kb.
-- NULL when payload is stored externally (see payload_ref).

ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS raw_payload jsonb;

-- ── 5. Add payload_ref column ─────────────────────────────────────────────────
-- Supabase Storage object path for payloads >256kb.
-- Format: webhook-payloads/{stripe_event_id}
-- NULL when payload is stored inline (raw_payload).

ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS payload_ref text;

-- ── 6. Backfill status from existing columns ──────────────────────────────────
-- Rows with processed=true → 'processed'
-- Rows with error_message IS NOT NULL and processed=false → 'failed'
-- All others → 'pending'

UPDATE public.webhook_events
  SET status = 'processed'
  WHERE processed = true AND status = 'pending';

UPDATE public.webhook_events
  SET status = 'failed'
  WHERE processed = false
    AND error_message IS NOT NULL
    AND status = 'pending';

-- ── 7. Index on status for DLQ queries ───────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_webhook_events_status
  ON public.webhook_events (status)
  WHERE status IN ('failed', 'pending');

-- ── 8. Index on tenant_id + status for per-tenant DLQ queries ────────────────

CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant_status
  ON public.webhook_events (tenant_id, status)
  WHERE status = 'failed';

COMMIT;
