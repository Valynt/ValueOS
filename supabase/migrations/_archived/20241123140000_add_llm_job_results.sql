-- LLM Job Results Schema
-- Stores results from async LLM processing queue

CREATE TABLE IF NOT EXISTS llm_job_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('canvas_generation', 'canvas_refinement', 'custom_prompt')),
  content TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost_usd DECIMAL(10, 6) NOT NULL,
  latency_ms INTEGER NOT NULL,
  cached BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_llm_job_results_job_id ON llm_job_results(job_id);
CREATE INDEX IF NOT EXISTS idx_llm_job_results_user ON llm_job_results(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_job_results_type ON llm_job_results(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_job_results_created ON llm_job_results(created_at DESC);

-- Row Level Security
ALTER TABLE llm_job_results ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own job results"
  ON llm_job_results FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Job results are insertable by authenticated users"
  ON llm_job_results FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to get user job statistics
CREATE OR REPLACE FUNCTION get_user_job_stats(p_user_id UUID, p_days INTEGER DEFAULT 7)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  start_date TIMESTAMPTZ;
BEGIN
  start_date := NOW() - (p_days || ' days')::INTERVAL;
  
  SELECT jsonb_build_object(
    'totalJobs', COUNT(*),
    'totalCost', SUM(cost_usd),
    'totalTokens', SUM(total_tokens),
    'avgLatency', AVG(latency_ms),
    'cacheHitRate', AVG(CASE WHEN cached THEN 1.0 ELSE 0.0 END),
    'byType', (
      SELECT jsonb_object_agg(type, stats)
      FROM (
        SELECT 
          type,
          jsonb_build_object(
            'count', COUNT(*),
            'cost', SUM(cost_usd),
            'avgLatency', AVG(latency_ms)
          ) as stats
        FROM llm_job_results
        WHERE user_id = p_user_id
          AND created_at >= start_date
        GROUP BY type
      ) type_stats
    ),
    'byProvider', (
      SELECT jsonb_object_agg(provider, count)
      FROM (
        SELECT provider, COUNT(*) as count
        FROM llm_job_results
        WHERE user_id = p_user_id
          AND created_at >= start_date
        GROUP BY provider
      ) provider_stats
    )
  )
  INTO result
  FROM llm_job_results
  WHERE user_id = p_user_id
    AND created_at >= start_date;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE llm_job_results IS 'Stores results from async LLM processing queue';
COMMENT ON COLUMN llm_job_results.job_id IS 'BullMQ job ID';
COMMENT ON COLUMN llm_job_results.type IS 'Type of LLM job';
COMMENT ON FUNCTION get_user_job_stats IS 'Returns job statistics for a user over specified days';
