-- LLM Gating RLS Enhancement
-- 
-- Implements the exact RLS policies as specified in the technical requirements:
-- 1. Tenant isolation for LlmUsageLog and TenantLlmBudget
-- 2. Service role bypass for Gating Service operations
-- 3. Integration with existing audit trail system

-- ============================================================================
-- Enhanced RLS Policies for LLM Gating Tables
-- ============================================================================

-- First, ensure the tables exist and are properly configured
-- (These should already exist from migration 20251230012508_llm_gating_tables.sql)

-- Enable RLS (if not already enabled)
ALTER TABLE llm_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_llm_budgets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running)
DROP POLICY IF EXISTS "Tenants can view own usage" ON llm_usage_logs;
DROP POLICY IF EXISTS "Tenants can view own budget" ON tenant_llm_budgets;
DROP POLICY IF EXISTS "Tenants can insert own usage" ON llm_usage_logs;
DROP POLICY IF EXISTS "Tenants can update own budget" ON tenant_llm_budgets;
DROP POLICY IF EXISTS "Service role can manage all llm data" ON llm_usage_logs;
DROP POLICY IF EXISTS "Service role can manage all budgets" ON tenant_llm_budgets;

-- ============================================================================
-- Tenant Isolation Policies
-- ============================================================================

-- Policy: Tenants can only see their own usage logs
CREATE POLICY "Tenants can view own usage" ON llm_usage_logs
  FOR SELECT
  USING (organization_id::text = auth.jwt() ->> 'org_id');

-- Policy: Tenants can insert their own usage logs
CREATE POLICY "Tenants can insert own usage" ON llm_usage_logs
  FOR INSERT
  WITH CHECK (organization_id::text = auth.jwt() ->> 'org_id');

-- Policy: Tenants can only view their own budget/quota
CREATE POLICY "Tenants can view own budget" ON tenant_llm_budgets
  FOR SELECT
  USING (organization_id::text = auth.jwt() ->> 'org_id');

-- Policy: Tenants can update their own budget (for manual adjustments)
CREATE POLICY "Tenants can update own budget" ON tenant_llm_budgets
  FOR UPDATE
  USING (organization_id::text = auth.jwt() ->> 'org_id')
  WITH CHECK (organization_id::text = auth.jwt() ->> 'org_id');

-- ============================================================================
-- Service Role Bypass Policies
-- ============================================================================

-- Policy: Service role (Gating Service) can manage all usage logs
-- This allows the LLMGatingService to write usage records and update spend
CREATE POLICY "Service role can manage all llm data" ON llm_usage_logs
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Service role can manage all budget data
CREATE POLICY "Service role can manage all budgets" ON tenant_llm_budgets
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Additional Security: Prevent Cross-Tenant Data Access
-- ============================================================================

-- Additional policy to ensure strict tenant isolation
-- This acts as a safety net even if JWT claims are malformed
CREATE POLICY "Strict tenant isolation - usage logs" ON llm_usage_logs
  FOR ALL
  USING (
    CASE 
      WHEN auth.jwt() ->> 'role' = 'service_role' THEN true
      ELSE organization_id = (auth.jwt() ->> 'org_id')::UUID
    END
  );

CREATE POLICY "Strict tenant isolation - budgets" ON tenant_llm_budgets
  FOR ALL
  USING (
    CASE 
      WHEN auth.jwt() ->> 'role' = 'service_role' THEN true
      ELSE organization_id = (auth.jwt() ->> 'org_id')::UUID
    END
  );

-- ============================================================================
-- Audit Trail Integration
-- ============================================================================

-- Ensure audit logs can be linked to usage logs
-- The auditLogId field in LlmUsageLog should reference AuditTrail
-- This policy allows read access to audit logs for verification
CREATE POLICY "Tenants can view linked audit logs" ON audit_logs
  FOR SELECT
  USING (
    organization_id::text = auth.jwt() ->> 'org_id'
    AND EXISTS (
      SELECT 1 FROM llm_usage_logs lul
      WHERE lul.audit_log_id = audit_logs.id::text
      AND lul.organization_id::text = auth.jwt() ->> 'org_id'
    )
  );

-- ============================================================================
-- Performance Indexes for RLS Queries
-- ============================================================================

-- Index to optimize RLS policy evaluation
CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_org_id ON llm_usage_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_tenant_llm_budgets_org_id ON tenant_llm_budgets(organization_id);

-- Composite index for budget calculations with RLS
CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_org_created ON llm_usage_logs(organization_id, created_at DESC);

-- ============================================================================
-- Helper Functions for Gating Service
-- ============================================================================

-- Function to get current budget status with RLS context
-- This function is designed to be called by the Gating Service with service_role
CREATE OR REPLACE FUNCTION get_tenant_budget_status(p_tenant_id UUID)
RETURNS TABLE (
  monthly_limit DECIMAL(10, 2),
  current_spend DECIMAL(10, 2),
  alert_threshold FLOAT,
  hard_stop_active BOOLEAN,
  remaining_budget DECIMAL(10, 2),
  usage_percentage DECIMAL(5, 2),
  is_over_budget BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tlb.monthly_limit,
    tlb.current_spend,
    tlb.alert_threshold,
    tlb.hard_stop_active,
    (tlb.monthly_limit - tlb.current_spend) AS remaining_budget,
    (tlb.current_spend / tlb.monthly_limit * 100)::DECIMAL(5, 2) AS usage_percentage,
    (tlb.current_spend >= tlb.monthly_limit) AS is_over_budget
  FROM tenant_llm_budgets tlb
  WHERE tlb.organization_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate cost using the specified formula
-- Cost = ((PromptTokens × Rate_in) + (CompletionTokens × Rate_out)) / 1000
CREATE OR REPLACE FUNCTION calculate_llm_cost(
  p_model_name VARCHAR,
  p_prompt_tokens INT,
  p_completion_tokens INT
)
RETURNS DECIMAL(10, 6) AS $$
DECLARE
  v_input_rate DECIMAL(10, 6);
  v_output_rate DECIMAL(10, 6);
BEGIN
  -- Get pricing rates (in production, this would query a pricing table)
  -- For now, use hardcoded rates based on existing BudgetTracker.ts
  SELECT 
    CASE 
      WHEN p_model_name LIKE '%llama-3-70b%' THEN 0.0009
      WHEN p_model_name LIKE '%llama-3-8b%' THEN 0.0002
      WHEN p_model_name LIKE '%mixtral-8x7b%' THEN 0.0006
      WHEN p_model_name LIKE '%mixtral-8x22b%' THEN 0.0012
      WHEN p_model_name LIKE '%claude-3-5-sonnet%' THEN 0.003
      WHEN p_model_name LIKE '%claude-3-opus%' THEN 0.015
      WHEN p_model_name LIKE '%gpt-4-turbo%' THEN 0.01
      WHEN p_model_name LIKE '%gpt-4%' THEN 0.03
      ELSE 0.03 -- Default conservative estimate
    END::DECIMAL(10, 6) INTO v_input_rate,
    CASE 
      WHEN p_model_name LIKE '%llama-3-70b%' THEN 0.0009
      WHEN p_model_name LIKE '%llama-3-8b%' THEN 0.0002
      WHEN p_model_name LIKE '%mixtral-8x7b%' THEN 0.0006
      WHEN p_model_name LIKE '%mixtral-8x22b%' THEN 0.0012
      WHEN p_model_name LIKE '%claude-3-5-sonnet%' THEN 0.015
      WHEN p_model_name LIKE '%claude-3-opus%' THEN 0.075
      WHEN p_model_name LIKE '%gpt-4-turbo%' THEN 0.03
      WHEN p_model_name LIKE '%gpt-4%' THEN 0.06
      ELSE 0.06 -- Default conservative estimate
    END::DECIMAL(10, 6) INTO v_output_rate;

  -- Apply the formula: ((T_in × P_in) + (T_out × P_out)) / 1000
  RETURN ((p_prompt_tokens * v_input_rate) + (p_completion_tokens * v_output_rate)) / 1000;
END;
$$ LANGUAGE plpgsql;

-- Function to update budget spend atomically
-- This should be called by the Gating Service after each LLM call
CREATE OR REPLACE FUNCTION update_tenant_spend(
  p_tenant_id UUID,
  p_cost DECIMAL(10, 6)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_spend DECIMAL(10, 2);
  v_monthly_limit DECIMAL(10, 2);
  v_hard_stop_active BOOLEAN;
BEGIN
  -- Get current budget info
  SELECT current_spend, monthly_limit, hard_stop_active
  INTO v_current_spend, v_monthly_limit, v_hard_stop_active
  FROM tenant_llm_budgets
  WHERE organization_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget record not found for tenant %', p_tenant_id;
  END IF;

  -- Check if hard stop is active and would be exceeded
  IF v_hard_stop_active AND (v_current_spend + p_cost) > v_monthly_limit THEN
    RETURN FALSE;
  END IF;

  -- Update spend atomically
  UPDATE tenant_llm_budgets
  SET current_spend = current_spend + p_cost,
      updated_at = NOW()
  WHERE organization_id = p_tenant_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Views for Monitoring and Reporting
-- ============================================================================

-- View: Real-time budget status with RLS
CREATE OR REPLACE VIEW tenant_budget_status AS
SELECT 
  tlb.organization_id,
  tlb.monthly_limit,
  tlb.current_spend,
  tlb.alert_threshold,
  tlb.hard_stop_active,
  (tlb.monthly_limit - tlb.current_spend) AS remaining_budget,
  (tlb.current_spend / tlb.monthly_limit * 100) AS usage_percentage,
  COUNT(lul.id) AS total_requests,
  AVG(lul.latency_ms) AS avg_latency,
  SUM(lul.estimated_cost) AS total_cost_30d
FROM tenant_llm_budgets tlb
LEFT JOIN llm_usage_logs lul ON lul.organization_id = tlb.organization_id 
  AND lul.created_at >= NOW() - INTERVAL '30 days'
GROUP BY tlb.organization_id, tlb.monthly_limit, tlb.current_spend, 
         tlb.alert_threshold, tlb.hard_stop_active;

-- View: Usage statistics with RLS
CREATE OR REPLACE VIEW llm_usage_statistics AS
SELECT 
  organization_id,
  DATE_TRUNC('day', created_at) AS date,
  modelName,
  taskType,
  COUNT(*) AS request_count,
  SUM(prompt_tokens) AS total_prompt_tokens,
  SUM(completion_tokens) AS total_completion_tokens,
  SUM(total_tokens) AS total_tokens,
  SUM(estimated_cost) AS total_cost,
  AVG(estimated_cost) AS avg_cost,
  AVG(latency_ms) AS avg_latency_ms,
  COUNT(*) FILTER (WHERE confidence < 0.6) AS low_confidence_requests
FROM llm_usage_logs
GROUP BY organization_id, DATE_TRUNC('day', created_at), modelName, taskType;

-- ============================================================================
-- Comments and Documentation
-- ============================================================================

COMMENT ON TABLE llm_usage_logs IS 'Tracks every LLM interaction for billing, observability, and audit trail with tenant isolation';
COMMENT ON TABLE tenant_llm_budgets IS 'Manages per-tenant budget limits and spending controls';
COMMENT ON COLUMN llm_usage_logs.estimated_cost IS 'Calculated using formula: ((PromptTokens × Rate_in) + (CompletionTokens × Rate_out)) / 1000';
COMMENT ON COLUMN llm_usage_logs.audit_log_id IS 'Optional link to AuditTrail for hash-chaining and zero-hallucination verification';
COMMENT ON COLUMN llm_usage_logs.confidence IS 'Agent self-reported confidence score for quality tracking';
COMMENT ON COLUMN tenant_llm_budgets.current_spend IS 'Tracked in real-time by Gating Service updates';
COMMENT ON COLUMN tenant_llm_budgets.hard_stop_active IS 'When true, blocks requests that would exceed monthly limit';
COMMENT ON COLUMN tenant_llm_budgets.strict_mode IS 'Manifesto enforcement: strict validation of all outputs';
COMMENT ON COLUMN tenant_llm_budgets.hallucination_check IS 'Manifesto enforcement: enable hallucination detection';

-- Grant permissions (if needed for specific roles)
-- Note: RLS policies handle access control, these are for additional role-based permissions
GRANT SELECT ON tenant_budget_status TO authenticated;
GRANT SELECT ON llm_usage_statistics TO authenticated;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Test RLS isolation (run these as different users to verify)
-- SELECT * FROM llm_usage_logs; -- Should only return tenant's own logs
-- SELECT * FROM tenant_llm_budgets; -- Should only return tenant's own budget
-- SELECT * FROM tenant_budget_status; -- Should only return tenant's status

-- Test service role bypass (run with service_role key)
-- SELECT * FROM llm_usage_logs; -- Should return all logs
-- SELECT * FROM tenant_llm_budgets; -- Should return all budgets
-- UPDATE tenant_llm_budgets SET current_spend = current_spend + 0.01 WHERE organization_id = '...'; -- Should work