-- Progressive Feature Rollout Tables
-- Enables gradual feature rollout with automatic rollback

BEGIN;

-- Feature rollout configurations
CREATE TABLE IF NOT EXISTS feature_rollouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name VARCHAR(255) NOT NULL UNIQUE,
  percentage INTEGER NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  target_groups TEXT[] DEFAULT '{}',
  exclude_groups TEXT[] DEFAULT '{}',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  auto_rollback BOOLEAN NOT NULL DEFAULT true,
  error_threshold DECIMAL(5,2) NOT NULL DEFAULT 5.0,
  rollback_reason TEXT,
  rollback_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Feature usage tracking
CREATE TABLE IF NOT EXISTS feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  enabled BOOLEAN NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Index for fast queries
  CONSTRAINT feature_usage_unique UNIQUE (feature_name, user_id, timestamp)
);

-- Feature error tracking
CREATE TABLE IF NOT EXISTS feature_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  error_message TEXT NOT NULL,
  error_stack TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_feature_rollouts_active ON feature_rollouts(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_feature_usage_feature_timestamp ON feature_usage(feature_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_feature_errors_feature_timestamp ON feature_errors(feature_name, timestamp DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_feature_rollouts_updated_at
BEFORE UPDATE ON feature_rollouts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE feature_rollouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_errors ENABLE ROW LEVEL SECURITY;

-- Policies for feature_rollouts
CREATE POLICY "Admins can manage feature rollouts"
ON feature_rollouts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    JOIN roles ON user_roles.role_id = roles.id
    WHERE user_roles.user_id = auth.uid()::text
    AND roles.name IN ('admin', 'developer')
  )
);

CREATE POLICY "All users can view active rollouts"
ON feature_rollouts
FOR SELECT
TO authenticated
USING (active = true);

-- Policies for feature_usage
CREATE POLICY "Users can insert their own usage"
ON feature_usage
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all usage"
ON feature_usage
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    JOIN roles ON user_roles.role_id = roles.id
    WHERE user_roles.user_id = auth.uid()::text
    AND roles.name IN ('admin', 'developer')
  )
);

-- Policies for feature_errors
CREATE POLICY "Users can insert their own errors"
ON feature_errors
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all errors"
ON feature_errors
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    JOIN roles ON user_roles.role_id = roles.id
    WHERE user_roles.user_id = auth.uid()::text
    AND roles.name IN ('admin', 'developer')
  )
);

-- View for rollout metrics
CREATE OR REPLACE VIEW feature_rollout_metrics AS
SELECT 
  fr.feature_name,
  fr.percentage,
  fr.active,
  COUNT(DISTINCT fu.user_id) FILTER (WHERE fu.timestamp > NOW() - INTERVAL '24 hours') as total_users_24h,
  COUNT(DISTINCT fu.user_id) FILTER (WHERE fu.enabled AND fu.timestamp > NOW() - INTERVAL '24 hours') as enabled_users_24h,
  COUNT(fe.id) FILTER (WHERE fe.timestamp > NOW() - INTERVAL '24 hours') as errors_24h,
  CASE 
    WHEN COUNT(DISTINCT fu.user_id) FILTER (WHERE fu.enabled AND fu.timestamp > NOW() - INTERVAL '24 hours') > 0
    THEN (COUNT(fe.id) FILTER (WHERE fe.timestamp > NOW() - INTERVAL '24 hours')::DECIMAL / 
          COUNT(DISTINCT fu.user_id) FILTER (WHERE fu.enabled AND fu.timestamp > NOW() - INTERVAL '24 hours')) * 100
    ELSE 0
  END as error_rate_24h,
  fr.error_threshold,
  CASE 
    WHEN COUNT(DISTINCT fu.user_id) FILTER (WHERE fu.enabled AND fu.timestamp > NOW() - INTERVAL '24 hours') > 0
    THEN (COUNT(fe.id) FILTER (WHERE fe.timestamp > NOW() - INTERVAL '24 hours')::DECIMAL / 
          COUNT(DISTINCT fu.user_id) FILTER (WHERE fu.enabled AND fu.timestamp > NOW() - INTERVAL '24 hours')) * 100 > fr.error_threshold
    ELSE false
  END as should_rollback
FROM feature_rollouts fr
LEFT JOIN feature_usage fu ON fr.feature_name = fu.feature_name
LEFT JOIN feature_errors fe ON fr.feature_name = fe.feature_name
GROUP BY fr.feature_name, fr.percentage, fr.active, fr.error_threshold;

-- Grant access to view
GRANT SELECT ON feature_rollout_metrics TO authenticated;

-- Function to automatically rollback features with high error rates
CREATE OR REPLACE FUNCTION check_and_rollback_features()
RETURNS void AS $$
DECLARE
  feature_record RECORD;
BEGIN
  FOR feature_record IN 
    SELECT feature_name, error_rate_24h, error_threshold
    FROM feature_rollout_metrics
    WHERE active = true 
    AND auto_rollback = true
    AND should_rollback = true
  LOOP
    UPDATE feature_rollouts
    SET 
      active = false,
      rollback_reason = 'Auto-rollback: Error rate ' || feature_record.error_rate_24h || '% exceeded threshold ' || feature_record.error_threshold || '%',
      rollback_at = NOW()
    WHERE feature_name = feature_record.feature_name;
    
    RAISE NOTICE 'Auto-rolled back feature: %', feature_record.feature_name;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule automatic rollback check (requires pg_cron extension)
-- Run every 5 minutes
-- SELECT cron.schedule('check-feature-rollbacks', '*/5 * * * *', 'SELECT check_and_rollback_features()');

COMMIT;
