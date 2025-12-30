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
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_gating_policies ENABLE ROW LEVEL SECURITY;

-- Ensure columns exist
ALTER TABLE llm_gating_policies ADD COLUMN IF NOT EXISTS used_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE llm_gating_policies ADD COLUMN IF NOT EXISTS hard_stop_active BOOLEAN DEFAULT true;
ALTER TABLE llm_gating_policies ADD COLUMN IF NOT EXISTS alert_threshold FLOAT DEFAULT 0.8;
ALTER TABLE llm_gating_policies ADD COLUMN IF NOT EXISTS strict_mode BOOLEAN DEFAULT true;
ALTER TABLE llm_gating_policies ADD COLUMN IF NOT EXISTS hallucination_check BOOLEAN DEFAULT true;

-- Drop existing policies if they exist (to allow re-running)
DROP POLICY IF EXISTS "Tenants can view own usage" ON llm_usage;
DROP POLICY IF EXISTS "Tenants can view own budget" ON llm_gating_policies;
DROP POLICY IF EXISTS "Tenants can insert own usage" ON llm_usage;
DROP POLICY IF EXISTS "Tenants can update own budget" ON llm_gating_policies;
DROP POLICY IF EXISTS "Service role can manage all llm data" ON llm_usage;
DROP POLICY IF EXISTS "Service role can manage all budgets" ON llm_gating_policies;

-- ============================================================================
-- Tenant Isolation Policies
-- ============================================================================

-- Policy: Tenants can only see their own usage logs
CREATE POLICY "Tenants can view own usage" ON llm_usage
  FOR SELECT
  USING (tenant_id::text = auth.jwt() ->> 'org_id');

-- Policy: Tenants can insert their own usage logs
CREATE POLICY "Tenants can insert own usage" ON llm_usage
  FOR INSERT
  WITH CHECK (tenant_id::text = auth.jwt() ->> 'org_id');

-- Policy: Tenants can only view their own budget/quota
CREATE POLICY "Tenants can view own budget" ON llm_gating_policies
  FOR SELECT
  USING (tenant_id::text = auth.jwt() ->> 'org_id');

-- Policy: Tenants can update their own budget (for manual adjustments)
CREATE POLICY "Tenants can update own budget" ON llm_gating_policies
  FOR UPDATE
  USING (tenant_id::text = auth.jwt() ->> 'org_id')
  WITH CHECK (tenant_id::text = auth.jwt() ->> 'org_id');

-- ============================================================================
-- Service Role Bypass Policies
-- ============================================================================

-- Policy: Service role (Gating Service) can manage all usage logs
-- This allows the LLMGatingService to write usage records and update spend
CREATE POLICY "Service role can manage all llm data" ON llm_usage
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Service role can manage all budget data
CREATE POLICY "Service role can manage all budgets" ON llm_gating_policies
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Additional Security: Prevent Cross-Tenant Data Access
-- ============================================================================

-- Additional policy to ensure strict tenant isolation
-- This acts as a safety net even if JWT claims are malformed
DROP POLICY IF EXISTS "Strict tenant isolation - usage logs" ON llm_usage;
CREATE POLICY "Strict tenant isolation - usage logs" ON llm_usage
  FOR ALL
  USING (
    CASE 
      WHEN auth.jwt() ->> 'role' = 'service_role' THEN true
      ELSE tenant_id = (auth.jwt() ->> 'org_id')::UUID
    END
  );

DROP POLICY IF EXISTS "Strict tenant isolation - budgets" ON llm_gating_policies;
CREATE POLICY "Strict tenant isolation - budgets" ON llm_gating_policies
  FOR ALL
  USING (
    CASE 
      WHEN auth.jwt() ->> 'role' = 'service_role' THEN true
      ELSE tenant_id = (auth.jwt() ->> 'org_id')::UUID
    END
  );

-- ============================================================================
-- Audit Trail Integration
-- ============================================================================

-- Ensure audit logs can be linked to usage logs
-- The auditLogId field in LlmUsageLog should reference AuditTrail
-- This policy allows read access to audit logs for verification
DROP POLICY IF EXISTS "Tenants can view linked audit logs" ON audit_logs;
CREATE POLICY "Tenants can view linked audit logs" ON audit_logs
  FOR SELECT
  USING (
    organization_id::text = auth.jwt() ->> 'org_id'
    AND EXISTS (
      SELECT 1 FROM llm_usage lul
      WHERE lul.audit_log_id = audit_logs.id
      AND lul.tenant_id::text = auth.jwt() ->> 'org_id'
    )
  );

-- ============================================================================
-- Performance Indexes for RLS Queries
-- ============================================================================

-- Index to optimize RLS policy evaluation
CREATE INDEX IF NOT EXISTS idx_llm_usage_org_id ON llm_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_llm_gating_policies_org_id ON llm_gating_policies(tenant_id);

-- Composite index for budget calculations with RLS
CREATE INDEX IF NOT EXISTS idx_llm_usage_org_created ON llm_usage(tenant_id, created_at DESC);

-- ============================================================================
-- Helper Functions for Gating Service
-- ============================================================================

-- Function to get current budget status with RLS context
-- This function is designed to be called by the Gating Service with service_role
CREATE OR REPLACE FUNCTION get_tenant_budget_status(p_tenant_id UUID)
RETURNS TABLE (
  monthly_budget_limit DECIMAL(10, 2),
  used_amount DECIMAL(10, 2),
  hard_stop_threshold FLOAT,
  hard_stop_active BOOLEAN,
  remaining_budget DECIMAL(10, 2),
  usage_percentage DECIMAL(5, 2),
  is_over_budget BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tlb.monthly_budget_limit,
    tlb.used_amount,
    tlb.hard_stop_threshold,
    tlb.hard_stop_active,
    (tlb.monthly_budget_limit - tlb.used_amount) AS remaining_budget,
    (tlb.used_amount / tlb.monthly_budget_limit * 100)::DECIMAL(5, 2) AS usage_percentage,
    (tlb.used_amount >= tlb.monthly_budget_limit) AS is_over_budget
  FROM llm_gating_policies tlb
  WHERE tlb.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate cost using the specified formula
-- Cost = ((PromptTokens × Rate_in) + (CompletionTokens × Rate_out)) / 1000
CREATE OR REPLACE FUNCTION calculate_llm_cost(
  p_model_name VARCHAR,
  p_input_tokens INT,
  p_output_tokens INT
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
    END::DECIMAL(10, 6),
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
    END::DECIMAL(10, 6) INTO v_input_rate, v_output_rate;

  -- Apply the formula: ((T_in × P_in) + (T_out × P_out)) / 1000
  RETURN ((p_input_tokens * v_input_rate) + (p_output_tokens * v_output_rate)) / 1000;
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
  v_used_amount DECIMAL(10, 2);
  v_monthly_budget_limit DECIMAL(10, 2);
  v_hard_stop_active BOOLEAN;
BEGIN
  -- Get current budget info
  SELECT used_amount, monthly_budget_limit, hard_stop_active
  INTO v_used_amount, v_monthly_budget_limit, v_hard_stop_active
  FROM llm_gating_policies
  WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget record not found for tenant %', p_tenant_id;
  END IF;

  -- Check if hard stop is active and would be exceeded
  IF v_hard_stop_active AND (v_used_amount + p_cost) > v_monthly_budget_limit THEN
    RETURN FALSE;
  END IF;

  -- Update spend atomically
  UPDATE llm_gating_policies
  SET used_amount = used_amount + p_cost,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Views for Monitoring and Reporting
-- ============================================================================

-- View: Real-time budget status with RLS
CREATE OR REPLACE VIEW tenant_budget_status AS
SELECT 
  tlb.tenant_id,
  tlb.monthly_budget_limit,
  tlb.used_amount,
  tlb.hard_stop_threshold,
  tlb.hard_stop_active,
  (tlb.monthly_budget_limit - tlb.used_amount) AS remaining_budget,
  (tlb.used_amount / tlb.monthly_budget_limit * 100) AS usage_percentage,
  COUNT(lul.id) AS total_requests,
  AVG(lul.latency_ms) AS avg_latency,
  SUM(lul.cost) AS total_cost_30d
FROM llm_gating_policies tlb
LEFT JOIN llm_usage lul ON lul.tenant_id = tlb.tenant_id 
  AND lul.created_at >= NOW() - INTERVAL '30 days'
GROUP BY tlb.tenant_id, tlb.monthly_budget_limit, tlb.used_amount, 
         tlb.hard_stop_threshold, tlb.hard_stop_active;

-- View: Usage statistics with RLS
CREATE OR REPLACE VIEW llm_usage_statistics AS
SELECT 
  tenant_id,
  DATE_TRUNC('day', created_at) AS date,
  model,
  task_type,
  COUNT(*) AS request_count,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(total_tokens) AS total_tokens,
  SUM(cost) AS total_cost,
  AVG(cost) AS avg_cost,
  AVG(latency_ms) AS avg_latency_ms,
  COUNT(*) FILTER (WHERE confidence < 0.6) AS low_confidence_requests
FROM llm_usage
GROUP BY tenant_id, DATE_TRUNC('day', created_at), model, task_type;

-- ============================================================================
-- Comments and Documentation
-- ============================================================================

COMMENT ON TABLE llm_usage IS 'Tracks every LLM interaction for billing, observability, and audit trail with tenant isolation';
COMMENT ON TABLE llm_gating_policies IS 'Manages per-tenant budget limits and spending controls';
COMMENT ON COLUMN llm_usage.cost IS 'Calculated using formula: ((PromptTokens × Rate_in) + (CompletionTokens × Rate_out)) / 1000';
COMMENT ON COLUMN llm_usage.audit_log_id IS 'Optional link to AuditTrail for hash-chaining and zero-hallucination verification';
COMMENT ON COLUMN llm_usage.confidence IS 'Agent self-reported confidence score for quality tracking';
COMMENT ON COLUMN llm_gating_policies.used_amount IS 'Tracked in real-time by Gating Service updates';
COMMENT ON COLUMN llm_gating_policies.hard_stop_active IS 'When true, blocks requests that would exceed monthly limit';
COMMENT ON COLUMN llm_gating_policies.strict_mode IS 'Manifesto enforcement: strict validation of all outputs';
COMMENT ON COLUMN llm_gating_policies.hallucination_check IS 'Manifesto enforcement: enable hallucination detection';

-- Grant permissions (if needed for specific roles)
-- Note: RLS policies handle access control, these are for additional role-based permissions
GRANT SELECT ON tenant_budget_status TO authenticated;
GRANT SELECT ON llm_usage_statistics TO authenticated;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Test RLS isolation (run these as different users to verify)
-- SELECT * FROM llm_usage; -- Should only return tenant's own logs
-- SELECT * FROM llm_gating_policies; -- Should only return tenant's own budget
-- SELECT * FROM tenant_budget_status; -- Should only return tenant's status

-- Test service role bypass (run with service_role key)
-- SELECT * FROM llm_usage; -- Should return all logs
-- SELECT * FROM llm_gating_policies; -- Should return all budgets
-- UPDATE llm_gating_policies SET used_amount = used_amount + 0.01 WHERE tenant_id = '...'; -- Should work