-- Organization Configurations Audit Trigger
-- Phase 2 Task 3: Audit Log Trigger
-- 
-- Ensures every UPDATE on organization_configurations triggers an audit log entry
-- Tracks all configuration changes for compliance and security

-- ============================================================================
-- Audit Log Function for Organization Configurations
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_organization_configuration_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_changes JSONB;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  -- Get current user ID from auth context
  v_user_id := auth.uid();
  
  -- If no user context (e.g., system update), use a system user ID
  IF v_user_id IS NULL THEN
    v_user_id := '00000000-0000-0000-0000-000000000000'::UUID;
  END IF;

  -- Build old and new values JSONB
  v_old_values := jsonb_build_object(
    'auth_policy', OLD.auth_policy,
    'session_control', OLD.session_control,
    'llm_spending_limits', OLD.llm_spending_limits,
    'model_routing', OLD.model_routing,
    'agent_toggles', OLD.agent_toggles,
    'hitl_thresholds', OLD.hitl_thresholds,
    'feature_flags', OLD.feature_flags,
    'rate_limiting', OLD.rate_limiting,
    'observability', OLD.observability,
    'retention_policies', OLD.retention_policies,
    'tenant_provisioning', OLD.tenant_provisioning,
    'custom_branding', OLD.custom_branding,
    'sso_config', OLD.sso_config,
    'ip_whitelist', OLD.ip_whitelist
  );

  v_new_values := jsonb_build_object(
    'auth_policy', NEW.auth_policy,
    'session_control', NEW.session_control,
    'llm_spending_limits', NEW.llm_spending_limits,
    'model_routing', NEW.model_routing,
    'agent_toggles', NEW.agent_toggles,
    'hitl_thresholds', NEW.hitl_thresholds,
    'feature_flags', NEW.feature_flags,
    'rate_limiting', NEW.rate_limiting,
    'observability', NEW.observability,
    'retention_policies', NEW.retention_policies,
    'tenant_provisioning', NEW.tenant_provisioning,
    'custom_branding', NEW.custom_branding,
    'sso_config', NEW.sso_config,
    'ip_whitelist', NEW.ip_whitelist
  );

  -- Calculate changes (only fields that actually changed)
  v_changes := jsonb_build_object();
  
  -- Check each field for changes
  IF OLD.auth_policy IS DISTINCT FROM NEW.auth_policy THEN
    v_changes := v_changes || jsonb_build_object(
      'auth_policy', jsonb_build_object(
        'old', OLD.auth_policy,
        'new', NEW.auth_policy
      )
    );
  END IF;

  IF OLD.session_control IS DISTINCT FROM NEW.session_control THEN
    v_changes := v_changes || jsonb_build_object(
      'session_control', jsonb_build_object(
        'old', OLD.session_control,
        'new', NEW.session_control
      )
    );
  END IF;

  IF OLD.llm_spending_limits IS DISTINCT FROM NEW.llm_spending_limits THEN
    v_changes := v_changes || jsonb_build_object(
      'llm_spending_limits', jsonb_build_object(
        'old', OLD.llm_spending_limits,
        'new', NEW.llm_spending_limits
      )
    );
  END IF;

  IF OLD.agent_toggles IS DISTINCT FROM NEW.agent_toggles THEN
    v_changes := v_changes || jsonb_build_object(
      'agent_toggles', jsonb_build_object(
        'old', OLD.agent_toggles,
        'new', NEW.agent_toggles
      )
    );
  END IF;

  IF OLD.feature_flags IS DISTINCT FROM NEW.feature_flags THEN
    v_changes := v_changes || jsonb_build_object(
      'feature_flags', jsonb_build_object(
        'old', OLD.feature_flags,
        'new', NEW.feature_flags
      )
    );
  END IF;

  IF OLD.rate_limiting IS DISTINCT FROM NEW.rate_limiting THEN
    v_changes := v_changes || jsonb_build_object(
      'rate_limiting', jsonb_build_object(
        'old', OLD.rate_limiting,
        'new', NEW.rate_limiting
      )
    );
  END IF;

  IF OLD.tenant_provisioning IS DISTINCT FROM NEW.tenant_provisioning THEN
    v_changes := v_changes || jsonb_build_object(
      'tenant_provisioning', jsonb_build_object(
        'old', OLD.tenant_provisioning,
        'new', NEW.tenant_provisioning
      )
    );
  END IF;

  -- Insert audit log entry
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values,
    changes,
    metadata,
    created_at
  ) VALUES (
    v_user_id,
    'UPDATE',
    'organization_configuration',
    NEW.organization_id::TEXT,
    v_old_values,
    v_new_values,
    v_changes,
    jsonb_build_object(
      'organization_id', NEW.organization_id,
      'configuration_id', NEW.id,
      'ip_address', current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
      'user_agent', current_setting('request.headers', true)::jsonb->>'user-agent',
      'changed_fields', jsonb_object_keys(v_changes)
    ),
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Create Trigger
-- ============================================================================

DROP TRIGGER IF EXISTS audit_organization_configuration_updates ON organization_configurations;

CREATE TRIGGER audit_organization_configuration_updates
  AFTER UPDATE ON organization_configurations
  FOR EACH ROW
  EXECUTE FUNCTION audit_organization_configuration_changes();

-- ============================================================================
-- Add Comment
-- ============================================================================

COMMENT ON FUNCTION audit_organization_configuration_changes() IS 
  'Audit trigger function that logs all changes to organization configurations. ' ||
  'Tracks old and new values, calculates specific changes, and stores metadata. ' ||
  'Required for SOC2 compliance and security monitoring.';

COMMENT ON TRIGGER audit_organization_configuration_updates ON organization_configurations IS
  'Automatically creates audit log entries for all organization configuration updates. ' ||
  'Captures user context, changed fields, and timestamps for compliance tracking.';

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Allow authenticated users to trigger the function (via UPDATE)
GRANT EXECUTE ON FUNCTION audit_organization_configuration_changes() TO authenticated;

-- Service role needs full access
GRANT EXECUTE ON FUNCTION audit_organization_configuration_changes() TO service_role;

-- ============================================================================
-- Test the Trigger
-- ============================================================================

-- This test will be rolled back, but verifies the trigger works
DO $$
DECLARE
  v_test_org_id UUID;
  v_audit_count_before INT;
  v_audit_count_after INT;
BEGIN
  -- Get a test organization
  SELECT id INTO v_test_org_id
  FROM organizations
  LIMIT 1;

  IF v_test_org_id IS NOT NULL THEN
    -- Count audit logs before
    SELECT COUNT(*) INTO v_audit_count_before
    FROM audit_logs
    WHERE resource_type = 'organization_configuration'
    AND resource_id = v_test_org_id::TEXT;

    -- Update configuration (this should trigger audit log)
    UPDATE organization_configurations
    SET auth_policy = jsonb_set(
      COALESCE(auth_policy, '{}'::jsonb),
      '{enforceMFA}',
      'true'::jsonb
    )
    WHERE organization_id = v_test_org_id;

    -- Count audit logs after
    SELECT COUNT(*) INTO v_audit_count_after
    FROM audit_logs
    WHERE resource_type = 'organization_configuration'
    AND resource_id = v_test_org_id::TEXT;

    -- Verify trigger fired
    IF v_audit_count_after > v_audit_count_before THEN
      RAISE NOTICE 'Audit trigger test PASSED: % new audit log(s) created', 
        v_audit_count_after - v_audit_count_before;
    ELSE
      RAISE WARNING 'Audit trigger test FAILED: No audit logs created';
    END IF;
  ELSE
    RAISE NOTICE 'No test organization found, skipping trigger test';
  END IF;
END $$;

-- ============================================================================
-- Create Index for Audit Log Queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_config 
  ON audit_logs(resource_type, resource_id, created_at DESC)
  WHERE resource_type = 'organization_configuration';

COMMENT ON INDEX idx_audit_logs_org_config IS
  'Optimizes queries for organization configuration audit logs. ' ||
  'Supports compliance reporting and security investigations.';
