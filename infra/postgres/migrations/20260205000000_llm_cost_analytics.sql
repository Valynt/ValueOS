-- Migration: Add get_llm_cost_analytics RPC function
-- Description: Aggregates LLM usage cost directly in the database for performance

CREATE OR REPLACE FUNCTION get_llm_cost_analytics(
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  WITH filtered_usage AS (
    SELECT
      estimated_cost,
      total_tokens,
      COALESCE(model, 'unknown') as model,
      COALESCE(user_id, 'unknown') as user_id,
      COALESCE(endpoint, 'unknown') as endpoint
    FROM llm_usage
    WHERE timestamp >= start_date AND timestamp <= end_date
  )
  SELECT json_build_object(
    'totalCost', COALESCE((SELECT SUM(estimated_cost) FROM filtered_usage), 0),
    'totalTokens', COALESCE((SELECT SUM(total_tokens) FROM filtered_usage), 0),
    'requestCount', (SELECT COUNT(*) FROM filtered_usage),
    'averageCostPerRequest', (
        CASE
            WHEN (SELECT COUNT(*) FROM filtered_usage) > 0 THEN COALESCE((SELECT SUM(estimated_cost) FROM filtered_usage), 0) / (SELECT COUNT(*) FROM filtered_usage)
            ELSE 0
        END
    ),
    'costByModel', (
      SELECT COALESCE(json_object_agg(model, cost), '{}'::json)
      FROM (
        SELECT model, SUM(estimated_cost) as cost
        FROM filtered_usage
        GROUP BY model
      ) m
    ),
    'costByUser', (
      SELECT COALESCE(json_object_agg(user_id, cost), '{}'::json)
      FROM (
        SELECT user_id, SUM(estimated_cost) as cost
        FROM filtered_usage
        GROUP BY user_id
      ) u
    ),
    'costByEndpoint', (
      SELECT COALESCE(json_object_agg(endpoint, cost), '{}'::json)
      FROM (
        SELECT endpoint, SUM(estimated_cost) as cost
        FROM filtered_usage
        GROUP BY endpoint
      ) e
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Secure the function
REVOKE EXECUTE ON FUNCTION get_llm_cost_analytics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_llm_cost_analytics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO service_role;
GRANT EXECUTE ON FUNCTION get_llm_cost_analytics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;
