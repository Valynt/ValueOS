-- Rollback: 20260304000700_usage_events_evidence_constraints
-- Reverts constraints and index added to usage_events by the matching migration.
-- Ensure these names match the ones used in the migration before applying.

-- Drop CHECK constraints (NOT VALID) added on usage_events.
ALTER TABLE public.usage_events
  DROP CONSTRAINT IF EXISTS usage_events_agent_uuid_check,
  DROP CONSTRAINT IF EXISTS usage_events_workload_identity_check;

-- Drop unique index added by the migration.
DROP INDEX IF EXISTS usage_events_agent_uuid_workload_identity_key;

-- Optionally drop columns added by the migration (uncomment if the migration added them).
-- ALTER TABLE public.usage_events
--   DROP COLUMN IF EXISTS agent_uuid,
--   DROP COLUMN IF EXISTS workload_identity;
