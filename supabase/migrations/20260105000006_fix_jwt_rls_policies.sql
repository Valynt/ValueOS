-- Fix JWT-Based RLS Policies
-- Purpose: Replace auth.jwt() with auth.uid() pattern for security
-- Priority: CRITICAL
-- Ref: PRE_RELEASE_AUDIT_2026-01-05.md Issue #3

-- ============================================================================
-- SECURITY ISSUE: JWT-based RLS policies are vulnerable to manipulation
-- 
-- Problem: Using auth.jwt() ->> 'org_id' or auth.jwt() ->> 'role' in policies
-- Risk: JWT claims can be manipulated if not properly validated
-- Solution: Use auth.uid() with lookup tables for tenant/org membership
-- ============================================================================

-- ============================================================================
-- 1. Create Helper Functions
-- ============================================================================

-- Function to get user's tenant IDs (already exists from tenant_isolation.sql)
-- Recreate as STABLE for better performance
CREATE OR REPLACE FUNCTION get_user_tenant_ids(p_user_id UUID)
RETURNS UUID[]
LANGUAGE SQL
SECURITY DEFINER
STABLE  -- Mark as STABLE for query planner optimization
AS $$
  SELECT ARRAY_AGG(tenant_id) 
  FROM user_tenants
  WHERE user_id = p_user_id 
  AND status = 'active';
$$;

COMMENT ON FUNCTION get_user_tenant_ids IS 
  'Returns array of active tenant IDs for a user (optimized with STABLE)';

-- Function to get user's organization IDs
CREATE OR REPLACE FUNCTION get_user_organization_ids(p_user_id UUID)
RETURNS UUID[]
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT ARRAY_AGG(organization_id) 
  FROM user_organizations
  WHERE user_id = p_user_id 
  AND status = 'active';
$$;

COMMENT ON FUNCTION get_user_organization_ids IS 
  'Returns array of active organization IDs for a user';

-- Function to check if user is admin in any organization
CREATE OR REPLACE FUNCTION is_user_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = p_user_id
    AND role IN ('admin', 'owner')
    AND status = 'active'
  );
$$;

COMMENT ON FUNCTION is_user_admin IS 
  'Returns true if user is admin/owner in any organization';

-- Function to check if user is admin in specific organization
CREATE OR REPLACE FUNCTION is_user_org_admin(p_user_id UUID, p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = p_user_id
    AND organization_id = p_org_id
    AND role IN ('admin', 'owner')
    AND status = 'active'
  );
$$;

COMMENT ON FUNCTION is_user_org_admin IS 
  'Returns true if user is admin/owner in specific organization';

-- ============================================================================
-- 2. Fix llm_gating_policies (from llm_gating_rls_enhancement.sql)
-- ============================================================================

-- Drop old JWT-based policies
DROP POLICY IF EXISTS "Tenants can view own budget" ON llm_gating_policies;
DROP POLICY IF EXISTS "Tenants can update own budget" ON llm_gating_policies;
DROP POLICY IF EXISTS "Service role can manage all budgets" ON llm_gating_policies;
DROP POLICY IF EXISTS "Strict tenant isolation - budgets" ON llm_gating_policies;

-- Create new auth.uid()-based policies
CREATE POLICY llm_gating_policies_select ON llm_gating_policies
  FOR SELECT
  USING (
    tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  );

CREATE POLICY llm_gating_policies_update ON llm_gating_policies
  FOR UPDATE
  USING (
    tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  )
  WITH CHECK (
    tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  );

CREATE POLICY llm_gating_policies_insert ON llm_gating_policies
  FOR INSERT
  WITH CHECK (
    tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  );

CREATE POLICY llm_gating_policies_service_role ON llm_gating_policies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY llm_gating_policies_select ON llm_gating_policies IS 
  'Users can view LLM gating policies for their tenants (auth.uid() based)';

-- ============================================================================
-- 3. Fix llm_usage (from llm_gating_rls_enhancement.sql)
-- ============================================================================

-- Drop old JWT-based policies
DROP POLICY IF EXISTS "Tenants can view own usage" ON llm_usage;
DROP POLICY IF EXISTS "Service role can manage all usage" ON llm_usage;
DROP POLICY IF EXISTS "Strict tenant isolation - usage" ON llm_usage;

-- Keep existing auth.uid()-based policies (they're already correct)
-- llm_usage_insert_own and llm_usage_select_own use auth.uid()

-- Add tenant-based policy for better isolation
CREATE POLICY llm_usage_tenant_select ON llm_usage
  FOR SELECT
  USING (
    tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  );

CREATE POLICY llm_usage_service_role ON llm_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY llm_usage_tenant_select ON llm_usage IS 
  'Users can view LLM usage for their tenants (auth.uid() based)';

-- ============================================================================
-- 4. Fix agent_accuracy_metrics
-- ============================================================================

-- Drop old JWT-based policies
DROP POLICY IF EXISTS "Users can view org metrics" ON agent_accuracy_metrics;
DROP POLICY IF EXISTS "Service role full access to metrics" ON agent_accuracy_metrics;

-- Create new auth.uid()-based policies
CREATE POLICY agent_accuracy_metrics_select ON agent_accuracy_metrics
  FOR SELECT
  USING (
    organization_id IS NULL 
    OR organization_id = ANY(get_user_organization_ids(auth.uid()))
  );

CREATE POLICY agent_accuracy_metrics_service_role ON agent_accuracy_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY agent_accuracy_metrics_select ON agent_accuracy_metrics IS 
  'Users can view metrics for their organizations (auth.uid() based)';

-- ============================================================================
-- 5. Fix agent_retraining_queue
-- ============================================================================

-- Drop old JWT-based policy
DROP POLICY IF EXISTS "Service role only for retraining queue" ON agent_retraining_queue;

-- Create new policy (service role only is correct, but use TO clause)
CREATE POLICY agent_retraining_queue_service_role ON agent_retraining_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY agent_retraining_queue_service_role ON agent_retraining_queue IS 
  'Only service role can manage retraining queue';

-- ============================================================================
-- 6. Fix backup_logs
-- ============================================================================

-- Drop old JWT-based policies
DROP POLICY IF EXISTS backup_logs_insert_system ON backup_logs;
DROP POLICY IF EXISTS backup_logs_select_admin ON backup_logs;

-- Create new auth.uid()-based policies
CREATE POLICY backup_logs_insert ON backup_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY backup_logs_select ON backup_logs
  FOR SELECT
  USING (
    is_user_admin(auth.uid())
  );

COMMENT ON POLICY backup_logs_select ON backup_logs IS 
  'Admins can view backup logs (auth.uid() based)';

-- ============================================================================
-- 7. Fix cost_alerts
-- ============================================================================

-- Drop old JWT-based policies
DROP POLICY IF EXISTS cost_alerts_insert_system ON cost_alerts;
DROP POLICY IF EXISTS cost_alerts_select_admin ON cost_alerts;
DROP POLICY IF EXISTS cost_alerts_update_admin ON cost_alerts;

-- Create new auth.uid()-based policies
CREATE POLICY cost_alerts_insert ON cost_alerts
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY cost_alerts_select ON cost_alerts
  FOR SELECT
  USING (
    is_user_admin(auth.uid())
  );

CREATE POLICY cost_alerts_update ON cost_alerts
  FOR UPDATE
  USING (
    is_user_admin(auth.uid())
  )
  WITH CHECK (
    is_user_admin(auth.uid())
  );

COMMENT ON POLICY cost_alerts_select ON cost_alerts IS 
  'Admins can view cost alerts (auth.uid() based)';

-- ============================================================================
-- 8. Fix rate_limit_violations
-- ============================================================================

-- Drop old JWT-based policies
DROP POLICY IF EXISTS rate_limit_violations_insert_system ON rate_limit_violations;
DROP POLICY IF EXISTS rate_limit_violations_select_admin ON rate_limit_violations;

-- Create new auth.uid()-based policies
CREATE POLICY rate_limit_violations_insert ON rate_limit_violations
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY rate_limit_violations_select ON rate_limit_violations
  FOR SELECT
  USING (
    is_user_admin(auth.uid())
  );

COMMENT ON POLICY rate_limit_violations_select ON rate_limit_violations IS 
  'Admins can view rate limit violations (auth.uid() based)';

-- ============================================================================
-- 9. Update helper functions in base schema (if they exist)
-- ============================================================================

-- Drop old JWT-based helper functions
DROP FUNCTION IF EXISTS get_current_org_id();
DROP FUNCTION IF EXISTS is_org_member(UUID);
DROP FUNCTION IF EXISTS is_admin_role();

-- Note: These functions used auth.jwt() and are no longer needed
-- The new helper functions above replace them

-- ============================================================================
-- 10. Grant permissions on new helper functions
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_user_tenant_ids TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_organization_ids TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_admin TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_org_admin TO authenticated;

-- ============================================================================
-- 11. Create view to audit JWT usage
-- ============================================================================

CREATE OR REPLACE VIEW jwt_policy_audit AS
SELECT 
  schemaname,
  tablename,
  policyname,
  CASE 
    WHEN qual LIKE '%auth.jwt()%' OR with_check LIKE '%auth.jwt()%' 
    THEN '⚠️ USES JWT'
    ELSE '✅ SAFE'
  END as status,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY 
  CASE 
    WHEN qual LIKE '%auth.jwt()%' OR with_check LIKE '%auth.jwt()%' THEN 0
    ELSE 1
  END,
  tablename;

COMMENT ON VIEW jwt_policy_audit IS 
  'Audits RLS policies for JWT usage (should show all SAFE after migration)';

GRANT SELECT ON jwt_policy_audit TO authenticated;

-- ============================================================================
-- 12. Verification queries
-- ============================================================================

DO $$
DECLARE
  v_jwt_policies INTEGER;
  v_total_policies INTEGER;
BEGIN
  -- Count policies still using JWT
  SELECT COUNT(*) INTO v_jwt_policies
  FROM pg_policies
  WHERE schemaname = 'public'
  AND (qual LIKE '%auth.jwt()%' OR with_check LIKE '%auth.jwt()%');
  
  -- Count total policies
  SELECT COUNT(*) INTO v_total_policies
  FROM pg_policies
  WHERE schemaname = 'public';
  
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'JWT-Based RLS Policy Migration Complete';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Total policies: %', v_total_policies;
  RAISE NOTICE 'Policies still using JWT: %', v_jwt_policies;
  
  IF v_jwt_policies > 0 THEN
    RAISE WARNING '⚠️  Some policies still use JWT - review jwt_policy_audit view';
  ELSE
    RAISE NOTICE '✅ All policies migrated to auth.uid() pattern';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Verification:';
  RAISE NOTICE '  SELECT * FROM jwt_policy_audit WHERE status = ''⚠️ USES JWT'';';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
END $$;
