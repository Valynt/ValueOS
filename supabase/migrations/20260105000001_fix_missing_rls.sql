-- Fix Missing RLS Policies
-- Purpose: Enable RLS on 13 tables without protection
-- Priority: CRITICAL
-- Ref: PRE_RELEASE_AUDIT_2026-01-05.md Issue #2

-- ============================================================================
-- ============================================================================
-- 1. llm_calls - LLM usage data
-- ============================================================================

DO $$
DECLARE
  t text;
  r record;
  alter_tables text[] := ARRAY[
    'llm_calls', 'webhook_events', 'integration_usage_log', 
    'memory_provenance', 'value_prediction_accuracy', 
    'approval_requests_archive', 'approvals_archive',
    'secret_audit_logs'
  ];
  policy_tables text[] := alter_tables || ARRAY[
    'secret_audit_logs_2024', 'secret_audit_logs_2025', 'secret_audit_logs_2026', 'secret_audit_logs_default'
  ];
BEGIN
  -- Drop policies on all relevant tables (including partitions)
  FOREACH t IN ARRAY policy_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name=t) THEN
      FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = t) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || t;
      END LOOP;
    END IF;
  END LOOP;

  -- Alter columns on parent/standalone tables
  FOREACH t IN ARRAY alter_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=t AND column_name='tenant_id') THEN
      EXECUTE 'ALTER TABLE ' || t || ' ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::text';
    END IF;
  END LOOP;
END $$;

ALTER TABLE llm_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY llm_calls_tenant_isolation ON llm_calls
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  );

CREATE POLICY llm_calls_service_role ON llm_calls
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2. webhook_events - Webhook payloads
-- ============================================================================

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_events_tenant_isolation ON webhook_events
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  );

CREATE POLICY webhook_events_service_role ON webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. login_attempts - Authentication data
-- ============================================================================

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Users can only view their own login attempts
CREATE POLICY login_attempts_own_data ON login_attempts
  FOR SELECT
  USING (user_id::text = auth.uid()::text);

-- Service role can manage all login attempts
CREATE POLICY login_attempts_service_role ON login_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- System can insert login attempts
CREATE POLICY login_attempts_system_insert ON login_attempts
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 4. integration_usage_log - Integration activity
-- ============================================================================

ALTER TABLE integration_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY integration_usage_log_tenant_isolation ON integration_usage_log
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  );

CREATE POLICY integration_usage_log_service_role ON integration_usage_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 5. memory_provenance - Agent memory tracking
-- ============================================================================

ALTER TABLE memory_provenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY memory_provenance_tenant_isolation ON memory_provenance
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  );

CREATE POLICY memory_provenance_service_role ON memory_provenance
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 6. value_prediction_accuracy - Business metrics
-- ============================================================================

ALTER TABLE value_prediction_accuracy ENABLE ROW LEVEL SECURITY;

CREATE POLICY value_prediction_accuracy_tenant_isolation ON value_prediction_accuracy
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  );

CREATE POLICY value_prediction_accuracy_service_role ON value_prediction_accuracy
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 7. approval_requests_archive - Archived approval data
-- ============================================================================

ALTER TABLE approval_requests_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY approval_requests_archive_tenant_isolation ON approval_requests_archive
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  );

CREATE POLICY approval_requests_archive_service_role ON approval_requests_archive
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 8. approvals_archive - Archived approvals
-- ============================================================================

ALTER TABLE approvals_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY approvals_archive_tenant_isolation ON approvals_archive
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  );

CREATE POLICY approvals_archive_service_role ON approvals_archive
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 9. retention_policies - Data retention config
-- ============================================================================

ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;

-- Only admins can view retention policies
CREATE POLICY retention_policies_admin_select ON retention_policies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND tenant_id::text = retention_policies.tenant_id
      AND role IN ('admin', 'owner')
      AND status = 'active'
    )
  );

-- Only admins can modify retention policies
CREATE POLICY retention_policies_admin_modify ON retention_policies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND tenant_id::text = retention_policies.tenant_id
      AND role IN ('admin', 'owner')
      AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND tenant_id::text = retention_policies.tenant_id
      AND role IN ('admin', 'owner')
      AND status = 'active'
    )
  );

CREATE POLICY retention_policies_service_role ON retention_policies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 10-13. secret_audit_logs partitions - Audit logs
-- ============================================================================

-- Note: secret_audit_logs parent table already has RLS enabled
-- Add SELECT policies for partitions

CREATE POLICY secret_audit_logs_2024_select ON secret_audit_logs_2024
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  );

CREATE POLICY secret_audit_logs_2025_select ON secret_audit_logs_2025
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  );

CREATE POLICY secret_audit_logs_2026_select ON secret_audit_logs_2026
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  );

CREATE POLICY secret_audit_logs_default_select ON secret_audit_logs_default
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id::text FROM user_tenants
      WHERE user_id::text = auth.uid()::text
      AND status = 'active'
    )
  );

-- Service role can access all audit logs
CREATE POLICY secret_audit_logs_2024_service_role ON secret_audit_logs_2024
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY secret_audit_logs_2025_service_role ON secret_audit_logs_2025
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY secret_audit_logs_2026_service_role ON secret_audit_logs_2026
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY secret_audit_logs_default_service_role ON secret_audit_logs_default
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON POLICY llm_calls_tenant_isolation ON llm_calls IS 
  'Ensures users can only access LLM calls from their tenants';

COMMENT ON POLICY webhook_events_tenant_isolation ON webhook_events IS 
  'Ensures users can only access webhook events from their tenants';

COMMENT ON POLICY login_attempts_own_data ON login_attempts IS 
  'Users can only view their own login attempts';

COMMENT ON POLICY integration_usage_log_tenant_isolation ON integration_usage_log IS 
  'Ensures users can only access integration usage from their tenants';

COMMENT ON POLICY memory_provenance_tenant_isolation ON memory_provenance IS 
  'Ensures users can only access memory provenance from their tenants';

COMMENT ON POLICY value_prediction_accuracy_tenant_isolation ON value_prediction_accuracy IS 
  'Ensures users can only access prediction accuracy from their tenants';

COMMENT ON POLICY retention_policies_admin_select ON retention_policies IS 
  'Only admins can view retention policies';
