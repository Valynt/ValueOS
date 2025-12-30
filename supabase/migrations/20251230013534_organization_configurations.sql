-- Organization Configurations Table
-- 
-- Comprehensive configuration management for multi-tenant organizations
-- Based on the Configuration & Settings Matrix specification

-- ============================================================================
-- Organization Configurations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- ========================================================================
  -- 1. Multi-Tenant & Organization Settings
  -- ========================================================================
  tenant_provisioning JSONB NOT NULL DEFAULT '{
    "status": "trial",
    "maxUsers": 10,
    "maxStorageGB": 10
  }'::jsonb,
  
  custom_branding JSONB DEFAULT NULL,
  
  data_residency JSONB NOT NULL DEFAULT '{
    "primaryRegion": "us-east-1"
  }'::jsonb,
  
  domain_management JSONB DEFAULT NULL,
  namespace_isolation JSONB DEFAULT NULL,
  
  -- ========================================================================
  -- 2. Identity & Access Management (IAM)
  -- ========================================================================
  auth_policy JSONB NOT NULL DEFAULT '{
    "enforceMFA": false,
    "enableWebAuthn": false,
    "enablePasswordless": false,
    "passwordPolicy": {
      "minLength": 8,
      "requireUppercase": true,
      "requireLowercase": true,
      "requireNumbers": true,
      "requireSpecialChars": false
    }
  }'::jsonb,
  
  sso_config JSONB DEFAULT NULL,
  
  session_control JSONB NOT NULL DEFAULT '{
    "timeoutMinutes": 60,
    "idleTimeoutMinutes": 30,
    "maxConcurrentSessions": 3
  }'::jsonb,
  
  ip_whitelist JSONB DEFAULT NULL,
  
  -- ========================================================================
  -- 3. AI Orchestration & Agent Fabric
  -- ========================================================================
  llm_spending_limits JSONB NOT NULL DEFAULT '{
    "monthlyHardCap": 1000,
    "monthlySoftCap": 800,
    "perRequestLimit": 10,
    "alertThreshold": 80,
    "alertRecipients": []
  }'::jsonb,
  
  model_routing JSONB NOT NULL DEFAULT '{
    "defaultModel": "together-llama-3-70b",
    "routingRules": [],
    "enableAutoDowngrade": true
  }'::jsonb,
  
  agent_toggles JSONB NOT NULL DEFAULT '{
    "enabledAgents": {
      "opportunityAgent": true,
      "targetAgent": true,
      "assumptionAgent": true,
      "riskAgent": true,
      "valueAgent": true
    }
  }'::jsonb,
  
  hitl_thresholds JSONB NOT NULL DEFAULT '{
    "autoApprovalThreshold": 0.9,
    "humanReviewThreshold": 0.7,
    "rejectionThreshold": 0.5,
    "reviewers": []
  }'::jsonb,
  
  ground_truth_sync JSONB DEFAULT NULL,
  
  formula_versioning JSONB NOT NULL DEFAULT '{
    "activeVersion": "1.0.0",
    "availableVersions": ["1.0.0"],
    "autoUpdate": false
  }'::jsonb,
  
  -- ========================================================================
  -- 4. Operational & Performance Settings
  -- ========================================================================
  feature_flags JSONB NOT NULL DEFAULT '{
    "enabledFeatures": {},
    "betaFeatures": {}
  }'::jsonb,
  
  rate_limiting JSONB NOT NULL DEFAULT '{
    "requestsPerMinute": 60,
    "requestsPerHour": 1000,
    "requestsPerDay": 10000,
    "burstAllowance": 10
  }'::jsonb,
  
  observability JSONB NOT NULL DEFAULT '{
    "traceSamplingRate": 0.1,
    "logVerbosity": "info",
    "enableMetrics": true,
    "enableTracing": true
  }'::jsonb,
  
  cache_management JSONB NOT NULL DEFAULT '{
    "cacheTTL": 300,
    "enableCache": true,
    "cacheStrategy": "lru"
  }'::jsonb,
  
  webhooks JSONB DEFAULT NULL,
  
  -- ========================================================================
  -- 5. Security, Audit & Governance
  -- ========================================================================
  audit_integrity JSONB NOT NULL DEFAULT '{
    "enableHashChaining": true,
    "verificationFrequencyHours": 24
  }'::jsonb,
  
  retention_policies JSONB NOT NULL DEFAULT '{
    "dataRetentionDays": 365,
    "logRetentionDays": 90,
    "auditRetentionDays": 2555,
    "financialRetentionYears": 7
  }'::jsonb,
  
  manifesto_strictness JSONB NOT NULL DEFAULT '{
    "mode": "warning",
    "enabledRules": []
  }'::jsonb,
  
  secret_rotation JSONB NOT NULL DEFAULT '{
    "autoRotation": false,
    "rotationFrequencyDays": 90
  }'::jsonb,
  
  rls_monitoring JSONB NOT NULL DEFAULT '{
    "enabled": true,
    "alertOnViolations": true,
    "performanceThresholdMs": 100
  }'::jsonb,
  
  -- ========================================================================
  -- 6. Billing & Usage Analytics
  -- ========================================================================
  token_dashboard JSONB NOT NULL DEFAULT '{
    "enableRealTime": true,
    "refreshIntervalSeconds": 30,
    "showCostBreakdown": true
  }'::jsonb,
  
  value_metering JSONB NOT NULL DEFAULT '{
    "enabled": false,
    "billableMilestones": [],
    "pricingModel": "per_user"
  }'::jsonb,
  
  subscription_plan JSONB NOT NULL DEFAULT '{
    "tier": "free",
    "billingCycle": "monthly",
    "autoRenew": true
  }'::jsonb,
  
  invoicing JSONB NOT NULL DEFAULT '{
    "paymentMethod": "credit_card",
    "billingEmail": ""
  }'::jsonb,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(organization_id)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_org_configs_org ON organization_configurations(organization_id);
CREATE INDEX idx_org_configs_updated ON organization_configurations(updated_at DESC);

-- GIN indexes for JSONB queries
CREATE INDEX idx_org_configs_tenant_status ON organization_configurations 
  USING GIN ((tenant_provisioning->'status'));

CREATE INDEX idx_org_configs_subscription_tier ON organization_configurations 
  USING GIN ((subscription_plan->'tier'));

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE organization_configurations IS 'Comprehensive configuration management for multi-tenant organizations';

COMMENT ON COLUMN organization_configurations.tenant_provisioning IS 'Tenant lifecycle and resource limits';
COMMENT ON COLUMN organization_configurations.custom_branding IS 'SDUI theme configuration (logos, colors, fonts)';
COMMENT ON COLUMN organization_configurations.data_residency IS 'Geographic data pinning configuration';
COMMENT ON COLUMN organization_configurations.auth_policy IS 'Authentication policies (MFA, WebAuthn, password rules)';
COMMENT ON COLUMN organization_configurations.llm_spending_limits IS 'LLM budget caps and alerts';
COMMENT ON COLUMN organization_configurations.agent_toggles IS 'Enable/disable specific AI agents';
COMMENT ON COLUMN organization_configurations.retention_policies IS 'Data and log retention periods';
COMMENT ON COLUMN organization_configurations.subscription_plan IS 'Billing tier and cycle';

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE organization_configurations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their organization's configuration
CREATE POLICY org_configs_tenant_isolation ON organization_configurations
  FOR ALL
  USING (organization_id = current_setting('app.current_tenant_id', true)::UUID);

-- Policy: Vendor admins can access all configurations
CREATE POLICY org_configs_vendor_admin ON organization_configurations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'vendor_admin'
    )
  );

-- ============================================================================
-- Triggers
-- ============================================================================

-- Update updated_at timestamp
CREATE TRIGGER update_org_configs_updated_at
  BEFORE UPDATE ON organization_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to get configuration for organization
CREATE OR REPLACE FUNCTION get_organization_config(p_organization_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_config JSONB;
BEGIN
  SELECT to_jsonb(organization_configurations.*) INTO v_config
  FROM organization_configurations
  WHERE organization_id = p_organization_id;
  
  RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_organization_config IS 'Get complete configuration for an organization';

-- Function to update specific configuration setting
CREATE OR REPLACE FUNCTION update_config_setting(
  p_organization_id UUID,
  p_setting TEXT,
  p_value JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
  EXECUTE format(
    'UPDATE organization_configurations SET %I = $1, updated_at = NOW() WHERE organization_id = $2',
    p_setting
  ) USING p_value, p_organization_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_config_setting IS 'Update a specific configuration setting';

-- ============================================================================
-- Default Configurations
-- ============================================================================

-- Insert default configurations for existing organizations
INSERT INTO organization_configurations (
  organization_id,
  tenant_provisioning,
  auth_policy,
  llm_spending_limits,
  feature_flags,
  audit_integrity,
  token_dashboard
)
SELECT 
  id,
  jsonb_build_object(
    'organizationId', id,
    'status', 'active',
    'maxUsers', 50,
    'maxStorageGB', 100,
    'createdAt', created_at,
    'updatedAt', updated_at
  ),
  '{
    "enforceMFA": false,
    "enableWebAuthn": false,
    "enablePasswordless": false,
    "passwordPolicy": {
      "minLength": 8,
      "requireUppercase": true,
      "requireLowercase": true,
      "requireNumbers": true,
      "requireSpecialChars": false
    }
  }'::jsonb,
  '{
    "monthlyHardCap": 1000,
    "monthlySoftCap": 800,
    "perRequestLimit": 10,
    "alertThreshold": 80,
    "alertRecipients": []
  }'::jsonb,
  '{
    "enabledFeatures": {},
    "betaFeatures": {}
  }'::jsonb,
  '{
    "enableHashChaining": true,
    "verificationFrequencyHours": 24
  }'::jsonb,
  '{
    "enableRealTime": true,
    "refreshIntervalSeconds": 30,
    "showCostBreakdown": true
  }'::jsonb
FROM organizations
WHERE NOT EXISTS (
  SELECT 1 FROM organization_configurations 
  WHERE organization_id = organizations.id
)
ON CONFLICT (organization_id) DO NOTHING;

-- ============================================================================
-- Configuration Change Audit View
-- ============================================================================

CREATE OR REPLACE VIEW configuration_change_audit AS
SELECT 
  al.id,
  al.organization_id,
  al.user_id,
  u.email as user_email,
  al.action,
  al.resource_id as setting_name,
  al.changes,
  al.created_at
FROM audit_logs al
LEFT JOIN users u ON u.id = al.user_id
WHERE al.resource_type = 'configuration'
ORDER BY al.created_at DESC;

COMMENT ON VIEW configuration_change_audit IS 'Audit trail of all configuration changes';
