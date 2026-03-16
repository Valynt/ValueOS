-- Rollback: 20260323000000_saga_transitions
-- Drops the saga_transitions table.

BEGIN;

DROP TABLE IF EXISTS public.saga_transitions CASCADE;

COMMIT;
