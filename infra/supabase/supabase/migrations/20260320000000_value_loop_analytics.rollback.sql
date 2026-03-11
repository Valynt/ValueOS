-- Rollback: 20260320000000_value_loop_analytics

SET search_path = public, pg_temp;

DROP TABLE IF EXISTS public.value_loop_events CASCADE;
