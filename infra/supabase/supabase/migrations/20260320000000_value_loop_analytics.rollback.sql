-- Rollback: 20260320000000_value_loop_analytics
-- Drops the value_loop_events table.

BEGIN;

DROP TABLE IF EXISTS public.value_loop_events CASCADE;

COMMIT;
