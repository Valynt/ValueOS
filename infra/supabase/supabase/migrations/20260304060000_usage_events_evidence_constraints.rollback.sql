-- Rollback: 20260304060000_usage_events_evidence_constraints
-- Removes agent_uuid and workload_identity columns from usage_events.

BEGIN;

ALTER TABLE public.usage_events
  DROP COLUMN IF EXISTS workload_identity,
  DROP COLUMN IF EXISTS agent_uuid;

COMMIT;
