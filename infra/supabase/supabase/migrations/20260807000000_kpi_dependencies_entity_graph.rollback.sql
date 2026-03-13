-- Rollback: 20260807000000_kpi_dependencies_entity_graph.sql
-- Drops entity graph and kpi dependency tables.

DROP TRIGGER IF EXISTS trg_entity_graph_edges_updated_at ON public.entity_graph_edges;
DROP TRIGGER IF EXISTS trg_kpi_dependencies_updated_at ON public.kpi_dependencies;

DROP TABLE IF EXISTS public.entity_graph_edges CASCADE;
DROP TABLE IF EXISTS public.kpi_dependencies CASCADE;
