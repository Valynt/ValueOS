-- Rollback: 20260804000000_state_events
-- Removes the state_events table and all associated objects.

BEGIN;

DROP TABLE IF EXISTS public.state_events;

COMMIT;
