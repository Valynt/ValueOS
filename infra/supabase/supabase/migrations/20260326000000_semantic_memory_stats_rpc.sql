-- Migration: get_semantic_memory_stats RPC
--
-- Replaces the three-query pattern in VectorSearchService.getStats() with a
-- single function call. The previous implementation fetched all `type` values
-- and grouped them in JavaScript, transferring O(n) rows for a stats call.
-- This function returns the same shape in one round-trip using SQL aggregation.

CREATE OR REPLACE FUNCTION public.get_semantic_memory_stats(p_organization_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total',       COUNT(*),
    'byType',      (
                     SELECT jsonb_object_agg(type, cnt)
                     FROM (
                       SELECT type, COUNT(*) AS cnt
                       FROM public.semantic_memory
                       WHERE organization_id = p_organization_id
                       GROUP BY type
                     ) t
                   ),
    'recentCount', COUNT(*) FILTER (
                     WHERE created_at >= now() - INTERVAL '7 days'
                   )
  )
  FROM public.semantic_memory
  WHERE organization_id = p_organization_id;
$$;

-- Grant execute only to service_role (backend usage)
GRANT EXECUTE ON FUNCTION public.get_semantic_memory_stats(uuid) TO service_role;
