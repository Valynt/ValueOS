-- Observability Tables Migration
-- Adds tables for tracking metrics, LLM calls, and value prediction accuracy

-- LLM Calls Tracking
CREATE TABLE IF NOT EXISTS llm_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID, -- Foreign key will be added later when agent_sessions exists
  agent_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'together_ai', 'openai', 'cache'
  model TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  latency_ms INTEGER NOT NULL,
  cost DECIMAL(10, 6) DEFAULT 0,
  cache_hit BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for llm_calls
CREATE INDEX IF NOT EXISTS idx_llm_calls_session ON llm_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_llm_calls_agent ON llm_calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_llm_calls_provider ON llm_calls(provider);
CREATE INDEX IF NOT EXISTS idx_llm_calls_created ON llm_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_calls_cache_hit ON llm_calls(cache_hit);

-- Add foreign key constraint if agent_sessions table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'agent_sessions'
  ) THEN
    ALTER TABLE llm_calls
    DROP CONSTRAINT IF EXISTS llm_calls_session_id_fkey;
    
    ALTER TABLE llm_calls
    ADD CONSTRAINT llm_calls_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Value Prediction Accuracy Tracking
CREATE TABLE IF NOT EXISTS value_prediction_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID REFERENCES agent_predictions(id) ON DELETE CASCADE,
  prediction_type TEXT NOT NULL, -- 'roi', 'cost_savings', 'revenue_increase', etc.
  predicted_value DECIMAL(15, 2) NOT NULL,
  actual_value DECIMAL(15, 2),
  error_value DECIMAL(15, 2),
  error_percent DECIMAL(5, 2),
  measurement_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for value_prediction_accuracy
CREATE INDEX IF NOT EXISTS idx_value_prediction_accuracy_type ON value_prediction_accuracy(prediction_type);
CREATE INDEX IF NOT EXISTS idx_value_prediction_accuracy_created ON value_prediction_accuracy(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_value_prediction_accuracy_measurement ON value_prediction_accuracy(measurement_date DESC);

-- Confidence Violations Tracking (already exists, but ensure it's created)
CREATE TABLE IF NOT EXISTS confidence_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL,
  prediction_id UUID REFERENCES agent_predictions(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL, -- 'low_confidence', 'hallucination', 'data_gaps'
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for confidence_violations
CREATE INDEX IF NOT EXISTS idx_confidence_violations_agent ON confidence_violations(agent_type);
CREATE INDEX IF NOT EXISTS idx_confidence_violations_type ON confidence_violations(violation_type);
CREATE INDEX IF NOT EXISTS idx_confidence_violations_created ON confidence_violations(created_at DESC);

-- Agent Performance Metrics (Materialized View for fast queries)
-- Note: Only create if agent_predictions has the required columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agent_predictions' 
    AND column_name = 'processing_time_ms'
  ) THEN
    DROP MATERIALIZED VIEW IF EXISTS agent_performance_metrics CASCADE;
    
    CREATE MATERIALIZED VIEW agent_performance_metrics AS
    SELECT
      agent_type,
      DATE_TRUNC('hour', created_at) as time_bucket,
      COUNT(*) as total_invocations,
      COUNT(*) FILTER (WHERE confidence_level = 'high') as high_confidence_count,
      COUNT(*) FILTER (WHERE confidence_level = 'medium') as medium_confidence_count,
      COUNT(*) FILTER (WHERE confidence_level = 'low') as low_confidence_count,
      COUNT(*) FILTER (WHERE hallucination_detected = true) as hallucination_count,
      AVG(confidence_score) as avg_confidence_score,
      AVG(processing_time_ms) as avg_processing_time_ms,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY processing_time_ms) as p50_processing_time_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms) as p95_processing_time_ms,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY processing_time_ms) as p99_processing_time_ms
    FROM agent_predictions
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY agent_type, time_bucket;

    -- Create index on materialized view
    CREATE INDEX IF NOT EXISTS idx_agent_performance_metrics_agent_time 
    ON agent_performance_metrics (agent_type, time_bucket DESC);

    -- Refresh function for materialized view
    CREATE OR REPLACE FUNCTION refresh_agent_performance_metrics()
    RETURNS void AS $func$
    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY agent_performance_metrics;
    END;
    $func$ LANGUAGE plpgsql;
  ELSE
    RAISE NOTICE 'Skipping agent_performance_metrics view - processing_time_ms column does not exist';
  END IF;
END $$;

-- LLM Performance Metrics (Materialized View)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'llm_calls') THEN
    DROP MATERIALIZED VIEW IF EXISTS llm_performance_metrics CASCADE;
    
    CREATE MATERIALIZED VIEW llm_performance_metrics AS
    SELECT
      provider,
      model,
      DATE_TRUNC('hour', created_at) as time_bucket,
      COUNT(*) as total_calls,
      COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
      COUNT(*) FILTER (WHERE cache_hit = false) as cache_misses,
      COUNT(*) FILTER (WHERE error IS NOT NULL) as error_count,
      AVG(latency_ms) as avg_latency_ms,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) as p50_latency_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99_latency_ms,
      SUM(total_tokens) as total_tokens,
      SUM(cost) as total_cost
    FROM llm_calls
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY provider, model, time_bucket;

    -- Create index on LLM metrics view
    CREATE INDEX IF NOT EXISTS idx_llm_performance_metrics_provider_time 
    ON llm_performance_metrics (provider, model, time_bucket DESC);

    -- Refresh function for LLM metrics
    CREATE OR REPLACE FUNCTION refresh_llm_performance_metrics()
    RETURNS void AS $func$
    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY llm_performance_metrics;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Value Prediction Accuracy Metrics (Materialized View)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'value_prediction_accuracy') THEN
    DROP MATERIALIZED VIEW IF EXISTS value_prediction_accuracy_metrics CASCADE;
    
    CREATE MATERIALIZED VIEW value_prediction_accuracy_metrics AS
    SELECT
      prediction_type,
      DATE_TRUNC('day', created_at) as time_bucket,
      COUNT(*) as total_predictions,
      COUNT(*) FILTER (WHERE actual_value IS NOT NULL) as predictions_with_actuals,
      AVG(predicted_value) as avg_predicted_value,
      AVG(actual_value) as avg_actual_value,
      AVG(error_value) as avg_error_value,
      AVG(error_percent) as avg_error_percent,
      STDDEV(error_percent) as stddev_error_percent
    FROM value_prediction_accuracy
    WHERE created_at > NOW() - INTERVAL '90 days'
    GROUP BY prediction_type, time_bucket;

    -- Create index on value prediction metrics view
    CREATE INDEX IF NOT EXISTS idx_value_prediction_accuracy_metrics_type_time 
    ON value_prediction_accuracy_metrics (prediction_type, time_bucket DESC);

    -- Refresh function for value prediction metrics
    CREATE OR REPLACE FUNCTION refresh_value_prediction_accuracy_metrics()
    RETURNS void AS $func$
    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY value_prediction_accuracy_metrics;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Scheduled refresh of materialized views (every 5 minutes)
-- Note: This requires pg_cron extension
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 
-- SELECT cron.schedule(
--   'refresh-agent-metrics',
--   '*/5 * * * *',
--   'SELECT refresh_agent_performance_metrics();'
-- );
-- 
-- SELECT cron.schedule(
--   'refresh-llm-metrics',
--   '*/5 * * * *',
--   'SELECT refresh_llm_performance_metrics();'
-- );
-- 
-- SELECT cron.schedule(
--   'refresh-value-prediction-metrics',
--   '*/5 * * * *',
--   'SELECT refresh_value_prediction_accuracy_metrics();'
-- );

-- RLS Policies for observability tables

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'llm_calls') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_sessions') THEN
    
    -- LLM Calls: Users can only see their own session's calls
    ALTER TABLE llm_calls ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can view their own LLM calls" ON llm_calls;
    DROP POLICY IF EXISTS "Service role can manage all LLM calls" ON llm_calls;

    CREATE POLICY "Users can view their own LLM calls"
    ON llm_calls FOR SELECT
    USING (
      session_id IN (
        SELECT id FROM agent_sessions WHERE user_id = auth.uid()
      )
    );

    CREATE POLICY "Service role can manage all LLM calls"
    ON llm_calls FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'value_prediction_accuracy') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_predictions') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_sessions') THEN
    
    -- Value Prediction Accuracy: Users can see their own predictions
    ALTER TABLE value_prediction_accuracy ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can view their own prediction accuracy" ON value_prediction_accuracy;
    DROP POLICY IF EXISTS "Service role can manage all prediction accuracy" ON value_prediction_accuracy;

    CREATE POLICY "Users can view their own prediction accuracy"
    ON value_prediction_accuracy FOR SELECT
    USING (
      prediction_id IN (
        SELECT id FROM agent_predictions 
        WHERE session_id IN (
          SELECT id FROM agent_sessions WHERE user_id = auth.uid()
        )
      )
    );

    CREATE POLICY "Service role can manage all prediction accuracy"
    ON value_prediction_accuracy FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'confidence_violations') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_predictions') AND
     EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_sessions') THEN
    
    -- Confidence Violations: Users can see their own violations
    ALTER TABLE confidence_violations ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can view their own confidence violations" ON confidence_violations;

    CREATE POLICY "Users can view their own confidence violations"
    ON confidence_violations FOR SELECT
    USING (
      prediction_id IN (
        SELECT id FROM agent_predictions 
        WHERE session_id IN (
          SELECT id FROM agent_sessions WHERE user_id = auth.uid()
        )
      )
    );

    DROP POLICY IF EXISTS "Service role can manage all confidence violations" ON confidence_violations;

    CREATE POLICY "Service role can manage all confidence violations"
    ON confidence_violations FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- Grant permissions (only if views exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'agent_performance_metrics') THEN
    GRANT SELECT ON agent_performance_metrics TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'llm_performance_metrics') THEN
    GRANT SELECT ON llm_performance_metrics TO authenticated;
  END IF;
  
  IF EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'value_prediction_accuracy_metrics') THEN
    GRANT SELECT ON value_prediction_accuracy_metrics TO authenticated;
  END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE llm_calls IS 'Tracks all LLM API calls for cost and performance monitoring';
COMMENT ON TABLE value_prediction_accuracy IS 'Tracks accuracy of value predictions against actual outcomes';
COMMENT ON TABLE confidence_violations IS 'Tracks instances where agent confidence thresholds are violated';

-- Comments for materialized views (only if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'agent_performance_metrics') THEN
    EXECUTE 'COMMENT ON MATERIALIZED VIEW agent_performance_metrics IS ''Aggregated agent performance metrics by hour''';
  END IF;
  
  IF EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'llm_performance_metrics') THEN
    EXECUTE 'COMMENT ON MATERIALIZED VIEW llm_performance_metrics IS ''Aggregated LLM performance metrics by hour''';
  END IF;
  
  IF EXISTS (SELECT FROM pg_matviews WHERE matviewname = 'value_prediction_accuracy_metrics') THEN
    EXECUTE 'COMMENT ON MATERIALIZED VIEW value_prediction_accuracy_metrics IS ''Aggregated value prediction accuracy metrics by day''';
  END IF;
END $$;
