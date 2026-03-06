-- Rollback: 20260304000700_usage_events_evidence_constraints
-- Removes NOT NULL constraints added to usage_events.
-- Identify exact constraint names from the migration before applying.
ALTER TABLE public.usage_events
  ALTER COLUMN request_id DROP NOT NULL,
  ALTER COLUMN trace_id   DROP NOT NULL;
