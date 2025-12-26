-- Migration: Fix agent_performance_summary view security setting
-- This migration explicitly sets SECURITY INVOKER to ensure RLS policies are respected
-- Issue: View was detected with SECURITY DEFINER which bypasses RLS for callers

-- Drop the existing view
DROP VIEW IF EXISTS agent_performance_summary;

-- Recreate with explicit SECURITY INVOKER (PostgreSQL 15+)
-- This ensures the view respects the caller's RLS policies, not the definer's
CREATE VIEW agent_performance_summary 
WITH (security_invoker = true) AS
SELECT 
  agent_type,
  COUNT(*) as total_predictions,
  AVG(confidence_score) as avg_confidence_score,
  COUNT(*) FILTER (WHERE confidence_level = 'low') as low_confidence_count,
  COUNT(*) FILTER (WHERE confidence_level = 'medium') as medium_confidence_count,
  COUNT(*) FILTER (WHERE confidence_level = 'high') as high_confidence_count,
  COUNT(*) FILTER (WHERE hallucination_detected = TRUE) as hallucination_count,
  ROUND(
    COUNT(*) FILTER (WHERE hallucination_detected = TRUE)::DECIMAL / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as hallucination_rate_pct,
  COUNT(*) FILTER (WHERE actual_outcome IS NOT NULL) as predictions_with_actuals,
  AVG(ABS(variance_percentage)) FILTER (WHERE actual_outcome IS NOT NULL) as avg_variance_pct,
  MAX(created_at) as last_prediction_at
FROM agent_predictions
GROUP BY agent_type;

-- Restore the comment
COMMENT ON VIEW agent_performance_summary IS 'Summary of agent performance metrics';

-- Grant appropriate permissions
GRANT SELECT ON agent_performance_summary TO authenticated;
REVOKE ALL ON agent_performance_summary FROM anon;
