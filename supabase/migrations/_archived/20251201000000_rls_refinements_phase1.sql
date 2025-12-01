-- ============================================================================
-- RLS Policy Refinements - Phase 1: Critical Security Fixes
-- ============================================================================
-- Created: 2025-12-01
-- Purpose: Harden existing RLS policies and add helper functions
-- Reference: docs/RLS_POLICY_REFINEMENTS.md

-- ============================================================================
-- 1. Helper Functions
-- ============================================================================

-- Admin verification function (SECURITY DEFINER = elevated privileges)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users
    WHERE id = auth.uid()
      AND (
        raw_user_meta_data->>'role' = 'admin' OR
        raw_user_meta_data->>'role' = 'service_role'
      )
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS 'Securely check if current user is an admin';

-- Tenant membership check
CREATE OR REPLACE FUNCTION public.is_tenant_member(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
  );
EXCEPTION
  WHEN undefined_table THEN
    -- If tenant_members doesn't exist yet, return false
    RETURN false;
END;
$$;

COMMENT ON FUNCTION public.is_tenant_member(UUID) IS 'Check if current user is member of tenant';

-- Tenant admin check
CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
EXCEPTION
  WHEN undefined_table THEN
    RETURN false;
END;
$$;

COMMENT ON FUNCTION public.is_tenant_admin(UUID) IS 'Check if current user is admin of tenant';

-- User owns record check (reusable)
CREATE OR REPLACE FUNCTION public.user_owns_record(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN auth.uid() = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.user_owns_record(UUID) IS 'Check if current user owns a record';

-- ============================================================================
-- 2. Fix Feature Flags Policy (Critical)
-- ============================================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Feature flags are insertable by authenticated users" ON feature_flags;
DROP POLICY IF EXISTS "Feature flags are updatable by authenticated users" ON feature_flags;
DROP POLICY IF EXISTS "Feature flags are deletable by authenticated users" ON feature_flags;

-- Admin-only management
CREATE POLICY "Admins can manage feature flags"
  ON feature_flags
  FOR ALL
  TO authenticated
  USING (public.is_admin());

-- Users can only read
CREATE POLICY "Users can read feature flags"
  ON feature_flags
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role bypass
CREATE POLICY "Service role full access to feature flags"
  ON feature_flags
  FOR ALL
  TO service_role
  USING (true);

-- ============================================================================
-- 3. Add Service Role Bypass to Critical Tables
-- ============================================================================

-- Agent Sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'agent_sessions' 
    AND policyname = 'Service role full access to agent_sessions'
  ) THEN
    CREATE POLICY "Service role full access to agent_sessions"
      ON agent_sessions
      FOR ALL
      TO service_role
      USING (true);
  END IF;
END $$;

-- Agent Metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'agent_metrics' 
    AND policyname = 'Service role full access to agent_metrics'
  ) THEN
    CREATE POLICY "Service role full access to agent_metrics"
      ON agent_metrics
      FOR ALL
      TO service_role
      USING (true);
  END IF;
END $$;

-- Semantic Memory
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'semantic_memory') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'semantic_memory' 
      AND policyname = 'Service role full access to semantic_memory'
    ) THEN
      CREATE POLICY "Service role full access to semantic_memory"
        ON semantic_memory
        FOR ALL
        TO service_role
        USING (true);
    END IF;
  END IF;
END $$;

-- Agent Predictions
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_predictions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'agent_predictions' 
      AND policyname = 'Service role full access to agent_predictions'
    ) THEN
      CREATE POLICY "Service role full access to agent_predictions"
        ON agent_predictions
        FOR ALL
        TO service_role
        USING (true);
    END IF;
  END IF;
END $$;

-- Cases
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'cases') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'cases' 
      AND policyname = 'Service role full access to cases'
    ) THEN
      CREATE POLICY "Service role full access to cases"
        ON cases
        FOR ALL
        TO service_role
        USING (true);
    END IF;
  END IF;
END $$;

-- Workflows
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflows') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'workflows' 
      AND policyname = 'Service role full access to workflows'
    ) THEN
      CREATE POLICY "Service role full access to workflows"
        ON workflows
        FOR ALL
        TO service_role
        USING (true);
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 4. Harden Admin-Only Tables
-- ============================================================================

-- Cost Alerts: Replace JWT check with is_admin()
DROP POLICY IF EXISTS "cost_alerts_select_admin" ON cost_alerts;
DROP POLICY IF EXISTS "cost_alerts_update_admin" ON cost_alerts;

CREATE POLICY "Admins can view cost alerts"
  ON cost_alerts
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can manage cost alerts"
  ON cost_alerts
  FOR INSERT, UPDATE, DELETE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Service role bypass
CREATE POLICY "Service role full access to cost alerts"
  ON cost_alerts
  FOR ALL
  TO service_role
  USING (true);

-- Rate Limit Violations
DROP POLICY IF EXISTS "rate_limit_violations_select_admin" ON rate_limit_violations;

CREATE POLICY "Admins can view rate limit violations"
  ON rate_limit_violations
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Service role can log violations"
  ON rate_limit_violations
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Backup Logs
DROP POLICY IF EXISTS "backup_logs_select_admin" ON backup_logs;

CREATE POLICY "Admins can view backup logs"
  ON backup_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Service role can manage backups"
  ON backup_logs
  FOR ALL
  TO service_role
  USING (true);

-- ============================================================================
-- 5. Harden Audit Log Tables (Immutability)
-- ============================================================================

-- Agent Audit Log
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_audit_log') THEN
    -- Prevent updates
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'agent_audit_log' 
      AND policyname = 'No updates to audit logs'
    ) THEN
      CREATE POLICY "No updates to audit logs"
        ON agent_audit_log
        FOR UPDATE
        USING (false);
    END IF;

    -- Prevent deletes (except service role for cleanup)
    DROP POLICY IF EXISTS "No deletes of audit logs" ON agent_audit_log;
    CREATE POLICY "Only service role can delete old audit logs"
      ON agent_audit_log
      FOR DELETE
      TO service_role
      USING (created_at < NOW() - INTERVAL '2 years');  -- Only old logs
  END IF;
END $$;

-- SOF Audit Events
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'sof_audit_events') THEN
    -- Prevent updates
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'sof_audit_events' 
      AND policyname = 'No updates to sof audit events'
    ) THEN
      CREATE POLICY "No updates to sof audit events"
        ON sof_audit_events
        FOR UPDATE
        USING (false);
    END IF;

    -- Prevent deletes
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'sof_audit_events' 
      AND policyname = 'No deletes of sof audit events'
    ) THEN
      CREATE POLICY "No deletes of sof audit events"
        ON sof_audit_events
        FOR DELETE
        USING (false);
    END IF;
  END IF;
END $$;

-- Secret Audit Logs
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'secret_audit_logs') THEN
    -- Prevent updates
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'secret_audit_logs' 
      AND policyname = 'No updates to secret audit logs'
    ) THEN
      CREATE POLICY "No updates to secret audit logs"
        ON secret_audit_logs
        FOR UPDATE
        USING (false);
    END IF;

    -- Prevent deletes
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'secret_audit_logs' 
      AND policyname = 'No deletes of secret audit logs'
    ) THEN
      CREATE POLICY "No deletes of secret audit logs"
        ON secret_audit_logs
        FOR DELETE
        USING (false);
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 6. Add Performance Indexes for RLS
-- ============================================================================

-- Indexes on user_id columns (used in most policies)
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON cases(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON agent_sessions(user_id) WHERE user_id IS NOT NULL;

-- Indexes on tenant_id columns (if exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'value_cases' AND column_name = 'tenant_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_value_cases_tenant_id ON value_cases(tenant_id);
  END IF;
END $$;

-- Composite indexes for common policy checks
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_status 
  ON agent_sessions(user_id, status) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_workflows_user_case 
  ON workflows(user_id, case_id) 
  WHERE user_id IS NOT NULL;

-- ============================================================================
-- 7. Add RLS Monitoring View
-- ============================================================================

CREATE OR REPLACE VIEW public.rls_policy_summary AS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  CASE 
    WHEN qual = 'true' THEN '⚠️  Always true (permissive)'
    WHEN qual LIKE '%auth.uid()%' THEN '✅ User-scoped'
    WHEN qual LIKE '%is_admin()%' THEN '🔒 Admin-only'
    WHEN qual LIKE '%service_role%' THEN '🔧 Service role'
    ELSE '❓ Custom logic'
  END AS policy_type,
  qual AS using_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

COMMENT ON VIEW public.rls_policy_summary IS 'Human-readable summary of all RLS policies';

-- ============================================================================
-- 8. Summary
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ RLS Refinements Phase 1 Complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes Applied:';
  RAISE NOTICE '  - Created 4 helper functions (is_admin, is_tenant_member, etc.)';
  RAISE NOTICE '  - Fixed feature flags policy (admin-only)';
  RAISE NOTICE '  - Added service role bypass to 8+ tables';
  RAISE NOTICE '  - Hardened admin-only tables (cost_alerts, rate_limit_violations, backup_logs)';
  RAISE NOTICE '  - Protected audit logs from updates/deletes';
  RAISE NOTICE '  - Added performance indexes on RLS columns';
  RAISE NOTICE '  - Created rls_policy_summary view for monitoring';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Review policy summary: SELECT * FROM rls_policy_summary;';
  RAISE NOTICE '  2. Run RLS tests: See test/rls_tests.sql';
  RAISE NOTICE '  3. Monitor performance: Check query plans';
  RAISE NOTICE '';
END $$;
