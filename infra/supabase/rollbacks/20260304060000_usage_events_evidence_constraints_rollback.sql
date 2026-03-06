-- ============================================================================
-- ROLLBACK: 20260304060000_usage_events_evidence_constraints
-- Removes evidence constraints and columns added to usage_events.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

ALTER TABLE public.usage_events
    DROP CONSTRAINT IF EXISTS usage_events_request_id_required,
    DROP CONSTRAINT IF EXISTS usage_events_agent_uuid_required,
    DROP CONSTRAINT IF EXISTS usage_events_workload_identity_required,
    DROP CONSTRAINT IF EXISTS usage_events_idempotency_key_required,
    DROP CONSTRAINT IF EXISTS usage_events_idempotency_key_sha256_check,
    DROP COLUMN IF EXISTS agent_uuid,
    DROP COLUMN IF EXISTS workload_identity;
