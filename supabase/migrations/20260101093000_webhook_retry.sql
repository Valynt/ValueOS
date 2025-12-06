-- Migration: Add webhook retry and dead letter queue tables

-- Add retry fields to webhook_events if not exists
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- Create dead letter queue table
CREATE TABLE IF NOT EXISTS webhook_dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    original_received_at TIMESTAMPTZ NOT NULL,
    moved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_retry ON webhook_events (processed, retry_count, next_retry_at) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_event_id ON webhook_dead_letter_queue (stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_moved_at ON webhook_dead_letter_queue (moved_at DESC);

-- RLS for dead letter queue
ALTER TABLE webhook_dead_letter_queue ENABLE ROW LEVEL SECURITY;

-- Only service role can access dead letter queue
CREATE POLICY webhook_dlq_service_only ON webhook_dead_letter_queue
  FOR ALL USING (true);
