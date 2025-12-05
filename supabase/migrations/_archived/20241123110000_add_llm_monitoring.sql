-- ============================================================================
-- Migration: Add LLM Monitoring and Cost Tracking
-- ============================================================================
-- Adds tables for tracking LLM usage, costs, rate limits, and alerts
-- ============================================================================

BEGIN;

-- LLM Usage Tracking Table
CREATE TABLE IF NOT EXISTS llm_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID, -- Foreign key will be added later when agent_sessions exists
    provider TEXT NOT NULL CHECK (provider IN ('together_ai', 'openai')),
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL CHECK (prompt_tokens >= 0),
    completion_tokens INTEGER NOT NULL CHECK (completion_tokens >= 0),
    total_tokens INTEGER GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
    estimated_cost DECIMAL(10, 6) NOT NULL CHECK (estimated_cost >= 0),
    endpoint TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    latency_ms INTEGER CHECK (latency_ms >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key constraint if agent_sessions table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'agent_sessions'
  ) THEN
    ALTER TABLE llm_usage
    DROP CONSTRAINT IF EXISTS llm_usage_session_id_fkey;
    
    ALTER TABLE llm_usage
    ADD CONSTRAINT llm_usage_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for LLM usage
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_id ON llm_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at ON llm_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_provider ON llm_usage(provider);
CREATE INDEX IF NOT EXISTS idx_llm_usage_model ON llm_usage(model);
CREATE INDEX IF NOT EXISTS idx_llm_usage_session_id ON llm_usage(session_id);

-- Composite index for cost queries
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_date_cost 
ON llm_usage(user_id, created_at DESC, estimated_cost);

-- Cost Alerts Table
CREATE TABLE IF NOT EXISTS cost_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level TEXT NOT NULL CHECK (level IN ('warning', 'critical')),
    period TEXT NOT NULL CHECK (period IN ('hourly', 'daily', 'monthly')),
    threshold DECIMAL(10, 2) NOT NULL,
    actual_cost DECIMAL(10, 2) NOT NULL,
    message TEXT NOT NULL,
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cost alerts
CREATE INDEX IF NOT EXISTS idx_cost_alerts_created_at ON cost_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_alerts_level ON cost_alerts(level);
CREATE INDEX IF NOT EXISTS idx_cost_alerts_acknowledged ON cost_alerts(acknowledged);

-- Rate Limit Violations Table
CREATE TABLE IF NOT EXISTS rate_limit_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address INET,
    endpoint TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'enterprise', 'anonymous')),
    limit_value INTEGER NOT NULL,
    window_ms INTEGER NOT NULL,
    violated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for rate limit violations
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_user_id ON rate_limit_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_violated_at ON rate_limit_violations(violated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_ip ON rate_limit_violations(ip_address);

-- Backup Logs Table
CREATE TABLE IF NOT EXISTS backup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_file TEXT NOT NULL,
    s3_path TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    checksum TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for backup logs
CREATE INDEX IF NOT EXISTS idx_backup_logs_created_at ON backup_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON backup_logs(status);

-- Enable RLS on all tables
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for llm_usage
CREATE POLICY llm_usage_select_own 
ON llm_usage FOR SELECT 
USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY llm_usage_insert_own 
ON llm_usage FOR INSERT 
WITH CHECK (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for cost_alerts (admin only)
CREATE POLICY cost_alerts_select_admin 
ON cost_alerts FOR SELECT 
USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY cost_alerts_insert_system 
ON cost_alerts FOR INSERT 
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY cost_alerts_update_admin 
ON cost_alerts FOR UPDATE 
USING (auth.jwt() ->> 'role' = 'admin');

-- RLS Policies for rate_limit_violations (admin only)
CREATE POLICY rate_limit_violations_select_admin 
ON rate_limit_violations FOR SELECT 
USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY rate_limit_violations_insert_system 
ON rate_limit_violations FOR INSERT 
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for backup_logs (admin only)
CREATE POLICY backup_logs_select_admin 
ON backup_logs FOR SELECT 
USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY backup_logs_insert_system 
ON backup_logs FOR INSERT 
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Function to get hourly LLM cost
CREATE OR REPLACE FUNCTION get_hourly_llm_cost()
RETURNS DECIMAL(10, 2) AS $$
BEGIN
    RETURN (
        SELECT COALESCE(SUM(estimated_cost), 0)
        FROM llm_usage
        WHERE created_at >= NOW() - INTERVAL '1 hour'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get daily LLM cost
CREATE OR REPLACE FUNCTION get_daily_llm_cost(p_user_id UUID DEFAULT NULL)
RETURNS DECIMAL(10, 2) AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN (
            SELECT COALESCE(SUM(estimated_cost), 0)
            FROM llm_usage
            WHERE created_at >= NOW() - INTERVAL '24 hours'
        );
    ELSE
        RETURN (
            SELECT COALESCE(SUM(estimated_cost), 0)
            FROM llm_usage
            WHERE user_id = p_user_id
            AND created_at >= NOW() - INTERVAL '24 hours'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get monthly LLM cost
CREATE OR REPLACE FUNCTION get_monthly_llm_cost()
RETURNS DECIMAL(10, 2) AS $$
BEGIN
    RETURN (
        SELECT COALESCE(SUM(estimated_cost), 0)
        FROM llm_usage
        WHERE created_at >= NOW() - INTERVAL '30 days'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get LLM usage statistics
CREATE OR REPLACE FUNCTION get_llm_usage_stats(
    p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
    p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    total_requests BIGINT,
    total_cost DECIMAL(10, 2),
    total_tokens BIGINT,
    avg_cost_per_request DECIMAL(10, 6),
    avg_latency_ms DECIMAL(10, 2),
    success_rate DECIMAL(5, 2),
    top_model TEXT,
    top_user UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_requests,
        COALESCE(SUM(estimated_cost), 0)::DECIMAL(10, 2) as total_cost,
        COALESCE(SUM(total_tokens), 0)::BIGINT as total_tokens,
        COALESCE(AVG(estimated_cost), 0)::DECIMAL(10, 6) as avg_cost_per_request,
        COALESCE(AVG(latency_ms), 0)::DECIMAL(10, 2) as avg_latency_ms,
        (COUNT(*) FILTER (WHERE success = true)::DECIMAL / NULLIF(COUNT(*), 0) * 100)::DECIMAL(5, 2) as success_rate,
        (
            SELECT model 
            FROM llm_usage 
            WHERE created_at BETWEEN p_start_date AND p_end_date
            GROUP BY model 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        ) as top_model,
        (
            SELECT user_id 
            FROM llm_usage 
            WHERE created_at BETWEEN p_start_date AND p_end_date
            GROUP BY user_id 
            ORDER BY SUM(estimated_cost) DESC 
            LIMIT 1
        ) as top_user
    FROM llm_usage
    WHERE created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old LLM usage data (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_llm_usage()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM llm_usage
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE llm_usage IS 'Tracks all LLM API calls with costs and performance metrics';
COMMENT ON TABLE cost_alerts IS 'Stores cost threshold violation alerts';
COMMENT ON TABLE rate_limit_violations IS 'Logs rate limit violations for analysis';
COMMENT ON TABLE backup_logs IS 'Tracks database backup operations';

COMMENT ON FUNCTION get_hourly_llm_cost() IS 'Returns total LLM cost for the last hour';
COMMENT ON FUNCTION get_daily_llm_cost(UUID) IS 'Returns total LLM cost for the last 24 hours, optionally filtered by user';
COMMENT ON FUNCTION get_monthly_llm_cost() IS 'Returns total LLM cost for the last 30 days';
COMMENT ON FUNCTION get_llm_usage_stats(TIMESTAMPTZ, TIMESTAMPTZ) IS 'Returns comprehensive LLM usage statistics for a date range';
COMMENT ON FUNCTION cleanup_old_llm_usage() IS 'Deletes LLM usage records older than 90 days';

COMMIT;
