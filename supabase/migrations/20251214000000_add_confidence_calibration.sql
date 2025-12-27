-- ============================================================================
-- Confidence Calibration Infrastructure
-- ============================================================================
-- Date: 2024-12-14
-- Priority: P0 - LAUNCH BLOCKER FIX
-- 
-- Implements confidence calibration against historical performance to ensure
-- agent confidence scores accurately reflect true probability of correctness.
-- 
-- Without calibration, agents may be overconfident or underconfident, leading
-- to incorrect decision-making and undermining the regulated actor framework.
-- ============================================================================

-- ============================================================================
-- 1. Agent Calibration Models Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_calibration_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  
  -- Platt scaling parameters
  -- Transforms raw confidence C_raw to calibrated C_cal:
  -- C_cal = 1 / (1 + exp(-(parameter_a * C_raw + parameter_b)))
  parameter_a DECIMAL(10, 6) NOT NULL,
  parameter_b DECIMAL(10, 6) NOT NULL,
  
  -- Calibration quality metrics
  sample_size INTEGER NOT NULL,
  calibration_error DECIMAL(5, 4) NOT NULL,
  
  -- Thresholds
  min_threshold DECIMAL(3, 2) DEFAULT 0.7,
  retraining_threshold DECIMAL(3, 2) DEFAULT 0.15,
  
  -- Timestamps
  last_calibrated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_calibration_agent_id 
  ON agent_calibration_models(agent_id);
  
CREATE INDEX IF NOT EXISTS idx_agent_calibration_last_calibrated 
  ON agent_calibration_models(last_calibrated DESC);

-- ============================================================================
-- 2. Agent Retraining Queue Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_retraining_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')) DEFAULT 'pending',
  
  -- Metadata
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add priority column if it doesn't exist (for existing tables)
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_retraining_queue' AND column_name = 'priority'
  ) THEN
    ALTER TABLE agent_retraining_queue
    ADD COLUMN priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium';
  END IF;
END $;

-- Add agent_id column if it doesn't exist (for existing tables created with different schema)
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_retraining_queue' AND column_name = 'agent_id'
  ) THEN
    ALTER TABLE agent_retraining_queue
    ADD COLUMN agent_id TEXT;
    -- If agent_type exists, copy its value to agent_id
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'agent_retraining_queue' AND column_name = 'agent_type'
    ) THEN
      UPDATE agent_retraining_queue SET agent_id = agent_type WHERE agent_id IS NULL;
    END IF;
  END IF;
END $;

-- Indexes for queue processing
CREATE INDEX IF NOT EXISTS idx_retraining_queue_status 
  ON agent_retraining_queue(status, priority DESC, created_at);
  
CREATE INDEX IF NOT EXISTS idx_retraining_queue_agent_id 
  ON agent_retraining_queue(agent_id);

-- ============================================================================
-- 3. Calibration History Table (for monitoring)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_calibration_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  
  -- Calibration metrics
  parameter_a DECIMAL(10, 6) NOT NULL,
  parameter_b DECIMAL(10, 6) NOT NULL,
  calibration_error DECIMAL(5, 4) NOT NULL,
  sample_size INTEGER NOT NULL,
  
  -- Accuracy metrics
  recent_accuracy DECIMAL(5, 4),
  prediction_count INTEGER,
  
  -- Timestamp
  calibrated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for trend analysis
CREATE INDEX IF NOT EXISTS idx_calibration_history_agent_time 
  ON agent_calibration_history(agent_id, calibrated_at DESC);

-- ============================================================================
-- 4. Update agent_predictions table to support calibration
-- ============================================================================

-- Add calibrated_confidence column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agent_predictions' 
    AND column_name = 'calibrated_confidence'
  ) THEN
    ALTER TABLE agent_predictions 
      ADD COLUMN calibrated_confidence DECIMAL(5, 4);
  END IF;
END $$;

-- Add calibration_model_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agent_predictions' 
    AND column_name = 'calibration_model_id'
  ) THEN
    ALTER TABLE agent_predictions 
      ADD COLUMN calibration_model_id UUID REFERENCES agent_calibration_models(id);
  END IF;
END $$;

-- Index for calibration analysis
CREATE INDEX IF NOT EXISTS idx_agent_predictions_calibration 
  ON agent_predictions(agent_id, calibrated_confidence);

-- ============================================================================
-- 5. Calibration Monitoring View
-- ============================================================================

CREATE OR REPLACE VIEW agent_calibration_status AS
SELECT 
  acm.agent_id,
  acm.agent_type,
  acm.parameter_a,
  acm.parameter_b,
  acm.calibration_error,
  acm.sample_size,
  acm.last_calibrated,
  
  -- Recent accuracy
  COUNT(ap.id) FILTER (WHERE ap.actual_outcome IS NOT NULL) as predictions_with_outcomes,
  COUNT(ap.id) FILTER (
    WHERE ap.actual_outcome IS NOT NULL 
    AND ABS(ap.variance_percentage) < 20
  ) as correct_predictions,
  
  CASE 
    WHEN COUNT(ap.id) FILTER (WHERE ap.actual_outcome IS NOT NULL) > 0
    THEN CAST(
      COUNT(ap.id) FILTER (
        WHERE ap.actual_outcome IS NOT NULL 
        AND ABS(ap.variance_percentage) < 20
      ) AS DECIMAL
    ) / COUNT(ap.id) FILTER (WHERE ap.actual_outcome IS NOT NULL)
    ELSE 0
  END as recent_accuracy,
  
  -- Needs recalibration?
  CASE
    WHEN acm.calibration_error > acm.retraining_threshold THEN true
    WHEN NOW() - acm.last_calibrated > INTERVAL '7 days' THEN true
    ELSE false
  END as needs_recalibration,
  
  -- Retraining queue status
  EXISTS (
    SELECT 1 FROM agent_retraining_queue arq
    WHERE arq.agent_id = acm.agent_id
    AND arq.status IN ('pending', 'in_progress')
  ) as retraining_queued

FROM agent_calibration_models acm
LEFT JOIN agent_predictions ap ON ap.agent_id = acm.agent_id
  AND ap.created_at > NOW() - INTERVAL '30 days'
WHERE acm.last_calibrated = (
  SELECT MAX(last_calibrated) 
  FROM agent_calibration_models 
  WHERE agent_id = acm.agent_id
)
GROUP BY 
  acm.agent_id, 
  acm.agent_type, 
  acm.parameter_a, 
  acm.parameter_b, 
  acm.calibration_error, 
  acm.sample_size, 
  acm.last_calibrated,
  acm.retraining_threshold;

-- Grant access to authenticated users
GRANT SELECT ON agent_calibration_status TO authenticated;

-- ============================================================================
-- 6. Calibration Trigger Function
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_calibration_on_outcome()
RETURNS TRIGGER AS $$
BEGIN
  -- When an actual outcome is recorded, check if recalibration is needed
  IF NEW.actual_outcome IS NOT NULL AND OLD.actual_outcome IS NULL THEN
    -- Get the latest calibration model
    DECLARE
      latest_calibration RECORD;
      predictions_since_calibration INTEGER;
    BEGIN
      SELECT * INTO latest_calibration
      FROM agent_calibration_models
      WHERE agent_id = NEW.agent_id
      ORDER BY last_calibrated DESC
      LIMIT 1;
      
      IF latest_calibration IS NOT NULL THEN
        -- Count predictions since last calibration
        SELECT COUNT(*) INTO predictions_since_calibration
        FROM agent_predictions
        WHERE agent_id = NEW.agent_id
        AND created_at > latest_calibration.last_calibrated
        AND actual_outcome IS NOT NULL;
        
        -- Trigger recalibration if we have 100+ new outcomes
        IF predictions_since_calibration >= 100 THEN
          INSERT INTO agent_retraining_queue (agent_id, reason, priority)
          VALUES (
            NEW.agent_id,
            'Automatic recalibration: 100+ new outcomes since last calibration',
            'medium'
          )
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to agent_predictions
DROP TRIGGER IF EXISTS trigger_calibration_check ON agent_predictions;
CREATE TRIGGER trigger_calibration_check
  AFTER UPDATE ON agent_predictions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calibration_on_outcome();

-- ============================================================================
-- 7. Helper Functions
-- ============================================================================

-- Function to get calibrated confidence for a raw score
CREATE OR REPLACE FUNCTION get_calibrated_confidence(
  p_agent_id TEXT,
  p_raw_confidence DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  v_model RECORD;
  v_z DECIMAL;
  v_calibrated DECIMAL;
BEGIN
  -- Get latest calibration model
  SELECT parameter_a, parameter_b INTO v_model
  FROM agent_calibration_models
  WHERE agent_id = p_agent_id
  ORDER BY last_calibrated DESC
  LIMIT 1;
  
  IF v_model IS NULL THEN
    -- No calibration model, return raw confidence
    RETURN p_raw_confidence;
  END IF;
  
  -- Apply Platt scaling: C_cal = 1 / (1 + exp(-(A * C_raw + B)))
  v_z := v_model.parameter_a * p_raw_confidence + v_model.parameter_b;
  v_calibrated := 1.0 / (1.0 + EXP(-v_z));
  
  -- Clamp to [0, 1]
  RETURN GREATEST(0.0, LEAST(1.0, v_calibrated));
END;
$$ LANGUAGE plpgsql;

-- Function to check if agent needs recalibration
CREATE OR REPLACE FUNCTION needs_recalibration(p_agent_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_status RECORD;
BEGIN
  SELECT needs_recalibration INTO v_status
  FROM agent_calibration_status
  WHERE agent_id = p_agent_id;
  
  RETURN COALESCE(v_status.needs_recalibration, true);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- VERIFICATION STEPS:
-- 
-- 1. Verify tables created:
--    SELECT tablename FROM pg_tables 
--    WHERE tablename LIKE 'agent_calibration%' OR tablename LIKE 'agent_retraining%';
-- 
-- 2. Verify view created:
--    SELECT * FROM agent_calibration_status LIMIT 5;
-- 
-- 3. Test calibration function:
--    SELECT get_calibrated_confidence('test-agent', 0.8);
-- 
-- 4. Test recalibration check:
--    SELECT needs_recalibration('test-agent');
-- 
-- ============================================================================
