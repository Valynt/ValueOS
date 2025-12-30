-- LLM Gating & Cost Control Tables
-- 
-- Implements the database schema for LLM gating policies and usage tracking
-- as specified in the technical specification

-- ============================================================================
-- LLM Gating Policies Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS llm_gating_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Budget configuration
  monthly_budget_limit DECIMAL(10, 2) NOT NULL CHECK (monthly_budget_limit > 0),
  hard_stop_threshold DECIMAL(3, 2) NOT NULL DEFAULT 0.95 CHECK (hard_stop_threshold BETWEEN 0 AND 1),
  per_request_limit DECIMAL(10, 2) CHECK (per_request_limit IS NULL OR per_request_limit > 0),
  grace_period_hours INTEGER DEFAULT 24 CHECK (grace_period_hours IS NULL OR grace_period_hours > 0),
  
  -- Model configuration
  default_model VARCHAR(100) NOT NULL,
  routing_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  enable_auto_downgrade BOOLEAN DEFAULT true,
  
  -- Manifesto enforcement
  manifesto_enforcement JSONB NOT NULL DEFAULT '{
    "strictMode": true,
    "hallucinationCheck": true,
    "conservativeQuantification": true,
    "valueFirstCheck": true
  }'::jsonb,
  
  -- Priority configuration
  priority_tier VARCHAR(20) DEFAULT 'medium' CHECK (priority_tier IN ('low', 'medium', 'high', 'critical')),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(tenant_id)
);

-- Indexes
CREATE INDEX idx_llm_gating_policies_tenant ON llm_gating_policies(tenant_id);
CREATE INDEX idx_llm_gating_policies_updated ON llm_gating_policies(updated_at DESC);

-- Comments
COMMENT ON TABLE llm_gating_policies IS 'LLM gating policies for tenant-specific cost control and model routing';
COMMENT ON COLUMN llm_gating_policies.monthly_budget_limit IS 'Monthly budget limit in USD';
COMMENT ON COLUMN llm_gating_policies.hard_stop_threshold IS 'Threshold (0-1) at which to stop all requests';
COMMENT ON COLUMN llm_gating_policies.routing_rules IS 'JSON array of task-to-model routing rules';
COMMENT ON COLUMN llm_gating_policies.manifesto_enforcement IS 'Manifesto compliance enforcement configuration';

-- ============================================================================
-- LLM Usage Tracking Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS llm_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Tenant and user context
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Model and tokens
  model VARCHAR(100) NOT NULL,
  input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0),
  total_tokens INTEGER NOT NULL CHECK (total_tokens >= 0),
  
  -- Cost calculation
  cost DECIMAL(10, 6) NOT NULL CHECK (cost >= 0),
  
  -- Request context
  task_type VARCHAR(50),
  agent_id VARCHAR(100),
  session_id UUID,
  trace_id VARCHAR(100),
  
  -- Response metadata
  latency_ms INTEGER,
  model_downgraded BOOLEAN DEFAULT false,
  original_model VARCHAR(100),
  
  -- Manifesto & Audit trail
  audit_log_id UUID UNIQUE REFERENCES audit_logs(id) ON DELETE SET NULL,
  confidence FLOAT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_llm_usage_tenant_date ON llm_usage(tenant_id, created_at DESC);
CREATE INDEX idx_llm_usage_user_date ON llm_usage(user_id, created_at DESC);
CREATE INDEX idx_llm_usage_model ON llm_usage(model);
CREATE INDEX idx_llm_usage_task_type ON llm_usage(task_type) WHERE task_type IS NOT NULL;
CREATE INDEX idx_llm_usage_agent ON llm_usage(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_llm_usage_session ON llm_usage(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_llm_usage_trace ON llm_usage(trace_id) WHERE trace_id IS NOT NULL;

-- Composite index for budget calculations
CREATE INDEX idx_llm_usage_budget_calc ON llm_usage(tenant_id, created_at DESC, cost);

-- Comments
COMMENT ON TABLE llm_usage IS 'LLM usage tracking for cost calculation and audit trail';
COMMENT ON COLUMN llm_usage.cost IS 'Calculated cost in USD using formula: ((T_in * P_in) + (T_out * P_out)) / 1000';
COMMENT ON COLUMN llm_usage.request_hash IS 'SHA-256 hash of request for audit trail';
COMMENT ON COLUMN llm_usage.response_hash IS 'SHA-256 hash of response for audit trail';

-- ============================================================================
-- Budget Status View
-- ============================================================================

CREATE OR REPLACE VIEW llm_budget_status AS
SELECT 
  p.tenant_id,
  p.monthly_budget_limit,
  p.hard_stop_threshold,
  COALESCE(SUM(u.cost) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days'), 0) AS used_amount,
  p.monthly_budget_limit - COALESCE(SUM(u.cost) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days'), 0) AS remaining_budget,
  (COALESCE(SUM(u.cost) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days'), 0) / p.monthly_budget_limit * 100) AS usage_percentage,
  COUNT(u.id) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days') AS request_count,
  p.monthly_budget_limit * 1.1 AS hard_limit
FROM llm_gating_policies p
LEFT JOIN llm_usage u ON u.tenant_id = p.tenant_id
GROUP BY p.tenant_id, p.monthly_budget_limit, p.hard_stop_threshold;

COMMENT ON VIEW llm_budget_status IS 'Real-time budget status for all tenants (30-day rolling window)';

-- ============================================================================
-- Usage Statistics View
-- ============================================================================

CREATE OR REPLACE VIEW llm_usage_stats AS
SELECT 
  tenant_id,
  DATE_TRUNC('day', created_at) AS date,
  model,
  task_type,
  COUNT(*) AS request_count,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(cost) AS total_cost,
  AVG(cost) AS avg_cost,
  AVG(latency_ms) AS avg_latency_ms,
  COUNT(*) FILTER (WHERE model_downgraded = true) AS downgrade_count
FROM llm_usage
GROUP BY tenant_id, DATE_TRUNC('day', created_at), model, task_type;

COMMENT ON VIEW llm_usage_stats IS 'Daily aggregated usage statistics by tenant, model, and task type';

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to get current budget status for a tenant
CREATE OR REPLACE FUNCTION get_budget_status(p_tenant_id UUID)
RETURNS TABLE (
  tenant_id UUID,
  budget_limit DECIMAL(10, 2),
  used_amount DECIMAL(10, 6),
  remaining_budget DECIMAL(10, 6),
  usage_percentage DECIMAL(5, 2),
  in_grace_period BOOLEAN,
  hard_limit DECIMAL(10, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.tenant_id,
    p.monthly_budget_limit,
    COALESCE(SUM(u.cost) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days'), 0),
    p.monthly_budget_limit - COALESCE(SUM(u.cost) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days'), 0),
    (COALESCE(SUM(u.cost) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days'), 0) / p.monthly_budget_limit * 100)::DECIMAL(5, 2),
    COALESCE(SUM(u.cost) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days'), 0) > p.monthly_budget_limit 
      AND COALESCE(SUM(u.cost) FILTER (WHERE u.created_at >= NOW() - INTERVAL '30 days'), 0) < (p.monthly_budget_limit * 1.1),
    p.monthly_budget_limit * 1.1
  FROM llm_gating_policies p
  LEFT JOIN llm_usage u ON u.tenant_id = p.tenant_id
  WHERE p.tenant_id = p_tenant_id
  GROUP BY p.tenant_id, p.monthly_budget_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_budget_status IS 'Get current budget status for a tenant (30-day rolling window)';

-- Function to check if request should be blocked
CREATE OR REPLACE FUNCTION should_block_request(
  p_tenant_id UUID,
  p_estimated_cost DECIMAL(10, 6)
)
RETURNS TABLE (
  blocked BOOLEAN,
  reason TEXT
) AS $$
DECLARE
  v_policy RECORD;
  v_status RECORD;
BEGIN
  -- Get policy
  SELECT * INTO v_policy
  FROM llm_gating_policies
  WHERE tenant_id = p_tenant_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Get current status
  SELECT * INTO v_status
  FROM get_budget_status(p_tenant_id);
  
  -- Check hard stop threshold
  IF v_status.usage_percentage >= (v_policy.hard_stop_threshold * 100) THEN
    -- Check grace period
    IF NOT v_status.in_grace_period THEN
      RETURN QUERY SELECT 
        true,
        format('Budget limit reached (%s%% of %s USD)', 
          v_status.usage_percentage, 
          v_policy.monthly_budget_limit);
      RETURN;
    END IF;
  END IF;
  
  -- Check if request would exceed budget
  IF (v_status.used_amount + p_estimated_cost) > v_policy.monthly_budget_limit THEN
    RETURN QUERY SELECT 
      true,
      format('Request would exceed budget limit (projected: %s USD, limit: %s USD)',
        v_status.used_amount + p_estimated_cost,
        v_policy.monthly_budget_limit);
    RETURN;
  END IF;
  
  -- Check per-request limit
  IF v_policy.per_request_limit IS NOT NULL AND p_estimated_cost > v_policy.per_request_limit THEN
    RETURN QUERY SELECT 
      true,
      format('Request cost (%s USD) exceeds per-request limit (%s USD)',
        p_estimated_cost,
        v_policy.per_request_limit);
    RETURN;
  END IF;
  
  -- All checks passed
  RETURN QUERY SELECT false, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION should_block_request IS 'Check if a request should be blocked based on budget and policy';

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE llm_gating_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;

-- Policies for llm_gating_policies
CREATE POLICY llm_gating_policies_tenant_isolation ON llm_gating_policies
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Policies for llm_usage
CREATE POLICY llm_usage_tenant_isolation ON llm_usage
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_llm_gating_policies_updated_at
  BEFORE UPDATE ON llm_gating_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Sample Data (for development)
-- ============================================================================

-- Insert default policy for existing organizations (if any)
INSERT INTO llm_gating_policies (
  tenant_id,
  monthly_budget_limit,
  hard_stop_threshold,
  default_model,
  routing_rules,
  manifesto_enforcement
)
SELECT 
  id,
  1000.00,
  0.95,
  'together-llama-3-70b',
  '[]'::jsonb,
  '{
    "strictMode": true,
    "hallucinationCheck": true,
    "conservativeQuantification": true,
    "valueFirstCheck": true
  }'::jsonb
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM llm_gating_policies WHERE tenant_id = organizations.id
)
ON CONFLICT (tenant_id) DO NOTHING;
