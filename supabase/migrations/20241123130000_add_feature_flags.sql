-- Feature Flags Schema
-- Enables dynamic feature toggles, A/B testing, and gradual rollouts

-- Feature Flags Table
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage INTEGER NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  targeting JSONB NOT NULL DEFAULT '{}',
  variants JSONB,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feature Flag Evaluations Table (for analytics)
CREATE TABLE IF NOT EXISTS feature_flag_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flag_key TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL,
  variant TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_feature_flags_key ON feature_flags(key);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX idx_feature_flag_evaluations_flag ON feature_flag_evaluations(flag_key, evaluated_at DESC);
CREATE INDEX idx_feature_flag_evaluations_user ON feature_flag_evaluations(user_id, evaluated_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feature_flag_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_feature_flag_timestamp
BEFORE UPDATE ON feature_flags
FOR EACH ROW
EXECUTE FUNCTION update_feature_flag_timestamp();

-- Function to get flag evaluation analytics
CREATE OR REPLACE FUNCTION get_flag_analytics(
  p_flag_key TEXT,
  p_days INTEGER DEFAULT 7
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  start_date TIMESTAMPTZ;
BEGIN
  start_date := NOW() - (p_days || ' days')::INTERVAL;
  
  SELECT jsonb_build_object(
    'totalEvaluations', COUNT(*),
    'enabledCount', COUNT(*) FILTER (WHERE enabled = true),
    'enabledPercentage', 
      CASE 
        WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE enabled = true)::FLOAT / COUNT(*)::FLOAT * 100)
        ELSE 0
      END,
    'variantDistribution', (
      SELECT jsonb_object_agg(variant, count)
      FROM (
        SELECT variant, COUNT(*) as count
        FROM feature_flag_evaluations
        WHERE flag_key = p_flag_key
          AND evaluated_at >= start_date
          AND variant IS NOT NULL
        GROUP BY variant
      ) variants
    )
  )
  INTO result
  FROM feature_flag_evaluations
  WHERE flag_key = p_flag_key
    AND evaluated_at >= start_date;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_evaluations ENABLE ROW LEVEL SECURITY;

-- Policies for feature_flags
CREATE POLICY "Feature flags are viewable by authenticated users"
  ON feature_flags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Feature flags are insertable by authenticated users"
  ON feature_flags FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Feature flags are updatable by authenticated users"
  ON feature_flags FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Feature flags are deletable by authenticated users"
  ON feature_flags FOR DELETE
  TO authenticated
  USING (true);

-- Policies for feature_flag_evaluations
CREATE POLICY "Users can view their own evaluations"
  ON feature_flag_evaluations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Evaluations are insertable by authenticated users"
  ON feature_flag_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Sample feature flags
INSERT INTO feature_flags (key, name, description, enabled, rollout_percentage, targeting, metadata) VALUES
(
  'llm_caching',
  'LLM Response Caching',
  'Enable caching of LLM responses to reduce costs',
  true,
  100,
  '{}',
  jsonb_build_object(
    'owner', 'platform-team',
    'tags', ARRAY['performance', 'cost-optimization'],
    'createdAt', NOW(),
    'updatedAt', NOW()
  )
),
(
  'new_canvas_ui',
  'New Canvas UI',
  'Gradual rollout of redesigned canvas interface',
  true,
  25,
  jsonb_build_object(
    'tiers', ARRAY['pro', 'enterprise']
  ),
  jsonb_build_object(
    'owner', 'product-team',
    'tags', ARRAY['ui', 'ux'],
    'createdAt', NOW(),
    'updatedAt', NOW()
  )
),
(
  'advanced_analytics',
  'Advanced Analytics',
  'Enable advanced analytics dashboard',
  true,
  100,
  jsonb_build_object(
    'tiers', ARRAY['enterprise']
  ),
  jsonb_build_object(
    'owner', 'analytics-team',
    'tags', ARRAY['analytics', 'enterprise'],
    'createdAt', NOW(),
    'updatedAt', NOW()
  )
),
(
  'ai_model_selection',
  'AI Model Selection',
  'A/B test different AI models',
  true,
  50,
  '{}',
  jsonb_build_object(
    'owner', 'ml-team',
    'tags', ARRAY['ai', 'ab-test'],
    'createdAt', NOW(),
    'updatedAt', NOW()
  )
);

-- Update ai_model_selection with variants
UPDATE feature_flags
SET variants = jsonb_build_array(
  jsonb_build_object(
    'name', 'llama-70b',
    'weight', 50,
    'config', jsonb_build_object(
      'model', 'meta-llama/Llama-3-70b-chat-hf',
      'temperature', 0.7
    )
  ),
  jsonb_build_object(
    'name', 'mixtral',
    'weight', 50,
    'config', jsonb_build_object(
      'model', 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      'temperature', 0.7
    )
  )
)
WHERE key = 'ai_model_selection';

-- Comments
COMMENT ON TABLE feature_flags IS 'Dynamic feature flags for A/B testing and gradual rollouts';
COMMENT ON TABLE feature_flag_evaluations IS 'Tracks feature flag evaluations for analytics';
COMMENT ON COLUMN feature_flags.rollout_percentage IS 'Percentage of users who see the feature (0-100)';
COMMENT ON COLUMN feature_flags.targeting IS 'Targeting rules: userIds, tiers, countries, customRules';
COMMENT ON COLUMN feature_flags.variants IS 'A/B test variants with weights and configs';
COMMENT ON FUNCTION get_flag_analytics IS 'Returns analytics for a feature flag over specified days';
