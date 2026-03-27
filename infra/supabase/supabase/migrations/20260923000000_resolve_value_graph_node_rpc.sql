-- Migration: resolve_value_graph_node RPC
--
-- Eliminates the N+1 loop in valueGraph.ts PATCH/DELETE handlers.
-- Previously, the application looped over vg_capabilities, vg_metrics, and
-- vg_value_drivers sequentially to find which table owns a node. This RPC
-- resolves ownership in a single DB call, returning the source_table so the
-- caller can dispatch exactly one targeted update or delete.
--
-- SECURITY DEFINER is NOT used here — the function runs with the caller's
-- RLS context. The organization_id parameter is an explicit filter, but RLS
-- policies on each table enforce tenant isolation independently.

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.resolve_value_graph_node(
  p_node_id        uuid,
  p_opportunity_id uuid,
  p_organization_id uuid
)
RETURNS TABLE (
  id               uuid,
  node_type        text,
  source_table     text
)
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT id, 'capability'::text AS node_type, 'vg_capabilities'::text AS source_table
  FROM public.vg_capabilities
  WHERE id               = p_node_id
    AND opportunity_id   = p_opportunity_id
    AND organization_id  = p_organization_id

  UNION ALL

  SELECT id, 'metric'::text AS node_type, 'vg_metrics'::text AS source_table
  FROM public.vg_metrics
  WHERE id               = p_node_id
    AND opportunity_id   = p_opportunity_id
    AND organization_id  = p_organization_id

  UNION ALL

  SELECT id, 'value_driver'::text AS node_type, 'vg_value_drivers'::text AS source_table
  FROM public.vg_value_drivers
  WHERE id               = p_node_id
    AND opportunity_id   = p_opportunity_id
    AND organization_id  = p_organization_id

  LIMIT 1;
$$;

-- Grant execute to authenticated users (RLS on underlying tables still applies).
GRANT EXECUTE ON FUNCTION public.resolve_value_graph_node(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_value_graph_node(uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.resolve_value_graph_node IS
  'Resolves which value graph table owns a node. Returns id, node_type, and source_table. '
  'Used by PATCH/DELETE handlers to avoid sequential multi-table lookups.';
