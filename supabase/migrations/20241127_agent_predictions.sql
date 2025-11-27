-- Agent Predictions Table
-- Stores LLM predictions with confidence scores and hallucination detection for accuracy tracking

CREATE TABLE IF NOT EXISTS agent_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_type TEXT NOT NULL, -- 'opportunity', 'target', 'expansion', 'integrity', 'realization'
  
  -- Input tracking
  input_hash TEXT NOT NULL,
  input_data JSONB NOT NULL,
  
  -- Prediction output
  prediction JSONB NOT NULL,
  confidence_level TEXT NOT NULL CHECK (confidence_level IN ('low', 'medium', 'high')),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- Quality indicators
  hallucination_detected BOOLEAN DEFAULT FALSE,
  hallucination_reasons TEXT[],
  assumptions JSONB DEFAULT '[]'::jsonb,
  data_gaps JSONB DEFAULT '[]'::jsonb,
  evidence JSONB DEFAULT '[]'::jsonb,
  reasoning TEXT,
  
  -- Actual outcome (filled in later for accuracy tracking)
  actual_outcome JSONB,
  actual_recorded_at TIMESTAMPTZ,
  variance_percentage DECIMAL(5,2),
  variance_absolute DECIMAL(15,2),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_agent_predictions_agent_type ON agent_predictions(agent_type);
CREATE INDEX idx_agent_predictions_session_id ON agent_predictions(session_id);
CREATE INDEX idx_agent_predictions_created_at ON agent_predictions(created_at DESC);
CREATE INDEX idx_agent_predictions_confidence ON agent_predictions(confidence_level, confidence_score);
CREATE INDEX idx_agent_predictions_hallucination ON agent_predictions(hallucination_detected) WHERE hallucination_detected = TRUE;
CREATE INDEX idx_agent_predictions_input_hash ON agent_predictions(input_hash);

-- Composite index for accuracy analysis
CREATE INDEX idx_agent_predictions_accuracy ON agent_predictions(agent_type, created_at DESC) 
  WHERE actual_outcome IS NOT NULL;

-- Confidence Violations Table
-- Tracks when predictions violate confidence thresholds

CREATE TABLE IF NOT EXISTS confidence_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL,
  prediction_id UUID REFERENCES agent_predictions(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL CHECK (violation_type IN ('low_confidence', 'hallucination', 'data_gaps')),
  details JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_confidence_violations_agent_type ON confidence_violations(agent_type);
CREATE INDEX idx_confidence_violations_created_at ON confidence_violations(created_at DESC);
CREATE INDEX idx_confidence_violations_type ON confidence_violations(violation_type);

-- Agent Accuracy Metrics Table
-- Aggregated accuracy metrics per agent type

CREATE TABLE IF NOT EXISTS agent_accuracy_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL,
  variance_percentage DECIMAL(5,2) NOT NULL,
  variance_absolute DECIMAL(15,2) NOT NULL,
  organization_id TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_accuracy_agent_type ON agent_accuracy_metrics(agent_type);
CREATE INDEX idx_agent_accuracy_recorded_at ON agent_accuracy_metrics(recorded_at DESC);
CREATE INDEX idx_agent_accuracy_org ON agent_accuracy_metrics(organization_id) WHERE organization_id IS NOT NULL;

-- Agent Retraining Queue Table
-- Tracks agents that need retraining due to accuracy degradation

CREATE TABLE IF NOT EXISTS agent_retraining_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  reason TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_retraining_status ON agent_retraining_queue(status);
CREATE INDEX idx_agent_retraining_scheduled ON agent_retraining_queue(scheduled_at);
CREATE INDEX idx_agent_retraining_agent_type ON agent_retraining_queue(agent_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for agent_predictions
CREATE TRIGGER update_agent_predictions_updated_at
  BEFORE UPDATE ON agent_predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- View for agent performance summary
CREATE OR REPLACE VIEW agent_performance_summary AS
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

-- View for recent confidence violations
CREATE OR REPLACE VIEW recent_confidence_violations AS
SELECT 
  cv.id,
  cv.agent_type,
  cv.violation_type,
  cv.details,
  cv.created_at,
  ap.confidence_level,
  ap.confidence_score,
  ap.hallucination_detected
FROM confidence_violations cv
JOIN agent_predictions ap ON cv.prediction_id = ap.id
WHERE cv.created_at > NOW() - INTERVAL '7 days'
ORDER BY cv.created_at DESC;

-- Function to calculate agent accuracy over time period
CREATE OR REPLACE FUNCTION get_agent_accuracy(
  p_agent_type TEXT,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  date DATE,
  prediction_count BIGINT,
  avg_confidence DECIMAL,
  hallucination_rate DECIMAL,
  avg_variance DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(ap.created_at) as date,
    COUNT(*) as prediction_count,
    ROUND(AVG(ap.confidence_score)::DECIMAL, 3) as avg_confidence,
    ROUND(
      (COUNT(*) FILTER (WHERE ap.hallucination_detected = TRUE)::DECIMAL / 
      NULLIF(COUNT(*), 0) * 100), 
      2
    ) as hallucination_rate,
    ROUND(AVG(ABS(ap.variance_percentage))::DECIMAL, 2) as avg_variance
  FROM agent_predictions ap
  WHERE ap.agent_type = p_agent_type
    AND ap.created_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(ap.created_at)
  ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE agent_predictions IS 'Stores LLM predictions with confidence scores and hallucination detection for accuracy tracking';
COMMENT ON TABLE confidence_violations IS 'Tracks when predictions violate confidence thresholds';
COMMENT ON TABLE agent_accuracy_metrics IS 'Aggregated accuracy metrics per agent type';
COMMENT ON TABLE agent_retraining_queue IS 'Tracks agents that need retraining due to accuracy degradation';
COMMENT ON VIEW agent_performance_summary IS 'Summary of agent performance metrics';
COMMENT ON VIEW recent_confidence_violations IS 'Recent confidence violations with prediction details';
COMMENT ON FUNCTION get_agent_accuracy IS 'Calculate agent accuracy metrics over a time period';
