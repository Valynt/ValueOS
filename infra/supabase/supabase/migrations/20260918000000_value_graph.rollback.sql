-- Rollback: value_graph
-- Drops all tables created by 20260918000000_value_graph.sql.
-- Safe to run multiple times (IF EXISTS guards).

SET search_path = public, pg_temp;

DROP TABLE IF EXISTS public.value_graph_edges CASCADE;
DROP TABLE IF EXISTS public.vg_value_drivers CASCADE;
DROP TABLE IF EXISTS public.vg_metrics CASCADE;
DROP TABLE IF EXISTS public.vg_capabilities CASCADE;
