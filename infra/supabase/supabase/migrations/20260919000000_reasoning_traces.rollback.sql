-- Rollback: reasoning_traces
-- Reverses 20260919000000_reasoning_traces.sql

SET search_path = public, pg_temp;

DROP TABLE IF EXISTS public.reasoning_traces;
