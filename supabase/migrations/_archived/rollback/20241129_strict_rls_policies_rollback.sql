-- Rollback for: 20241129_strict_rls_policies.sql
-- Purpose: Remove strict RLS policies and related infrastructure
-- DANGER: This will remove database-level tenant isolation!
-- ALWAYS backup before running this script!

-- =============================================================================
-- SAFETY CHECK
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE 'WARNING: About to remove all RLS policies!';
    RAISE NOTICE 'This will remove database-level security!';
    RAISE NOTICE 'Press Ctrl+C within 5 seconds to cancel...';
    PERFORM pg_sleep(5);
END $$;

-- =============================================================================
-- DROP RLS POLICIES
-- =============================================================================

-- User Tenants
DROP POLICY IF EXISTS "Users can view their own tenant memberships" ON user_tenants;
DROP POLICY IF EXISTS "Prevent unauthorized tenant changes" ON user_tenants;

-- Workflow Executions
DROP POLICY IF EXISTS "Users can view workflow executions in their tenants" ON workflow_executions;
DROP POLICY IF EXISTS "Users can create workflow executions in their tenants" ON workflow_executions;
DROP POLICY IF EXISTS "Users can update their own workflow executions" ON workflow_executions;

-- Workflow Execution Logs
DROP POLICY IF EXISTS "Users can view logs for their workflow executions" ON workflow_execution_logs;

-- Workflow Events
DROP POLICY IF EXISTS "Users can view events for their workflow executions" ON workflow_events;

-- Workflow Audit Logs
DROP POLICY IF EXISTS "Users can view audit logs for their workflow executions" ON workflow_audit_logs;

-- Agent Predictions
DROP POLICY IF EXISTS "Users can view their own predictions" ON agent_predictions;
DROP POLICY IF EXISTS "Users can insert their own predictions" ON agent_predictions;
DROP POLICY IF EXISTS "Prevent prediction modifications" ON agent_predictions;
DROP POLICY IF EXISTS "Prevent prediction deletions" ON agent_predictions;

-- Value Trees
DROP POLICY IF EXISTS "Users can view their tenant value trees" ON value_trees;
DROP POLICY IF EXISTS "Users can update their tenant value trees" ON value_trees;

-- Canvas Data
DROP POLICY IF EXISTS "Users can view their tenant canvas data" ON canvas_data;
DROP POLICY IF EXISTS "Users can update their tenant canvas data" ON canvas_data;

-- Billing Subscriptions
DROP POLICY IF EXISTS "Users can view their tenant subscriptions" ON billing_subscriptions;
DROP POLICY IF EXISTS "Prevent user billing modifications" ON billing_subscriptions;

-- Billing Usage
DROP POLICY IF EXISTS "Users can view their tenant usage" ON billing_usage;
DROP POLICY IF EXISTS "Prevent user usage modifications" ON billing_usage;

-- Security Audit Log
DROP POLICY IF EXISTS "Only admins can view security audit logs" ON security_audit_log;

-- =============================================================================
-- DISABLE RLS
-- =============================================================================

ALTER TABLE IF EXISTS user_tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_executions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_execution_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workflow_audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_predictions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS value_trees DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS canvas_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS billing_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS billing_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS security_audit_log DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- DROP AUDIT INFRASTRUCTURE
-- =============================================================================

-- Drop audit trigger function
DROP FUNCTION IF EXISTS log_rls_violation() CASCADE;

-- Drop security audit log table
DROP TABLE IF EXISTS security_audit_log CASCADE;

-- =============================================================================
-- DROP PERFORMANCE INDEXES
-- =============================================================================

DROP INDEX IF EXISTS idx_user_tenants_user_tenant;
DROP INDEX IF EXISTS idx_workflow_executions_tenant;
DROP INDEX IF EXISTS idx_agent_predictions_user;
DROP INDEX IF EXISTS idx_value_trees_tenant;
DROP INDEX IF EXISTS idx_canvas_data_tenant;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
    rls_count INTEGER;
    policy_count INTEGER;
BEGIN
    -- Count tables with RLS enabled
    SELECT COUNT(*) INTO rls_count
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND rowsecurity = true;
    
    -- Count remaining policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public';
    
    RAISE NOTICE 'Rollback complete:';
    RAISE NOTICE '  - Tables with RLS enabled: %', rls_count;
    RAISE NOTICE '  - Remaining policies: %', policy_count;
    
    IF rls_count > 0 OR policy_count > 0 THEN
        RAISE WARNING 'Some RLS policies or settings remain! Manual cleanup may be needed.';
    ELSE
        RAISE NOTICE '  ✓ All RLS policies removed successfully';
    END IF;
END $$;

-- =============================================================================
-- POST-ROLLBACK NOTES
-- =============================================================================

COMMENT ON DATABASE current_database() IS 
    'RLS policies rolled back on ' || CURRENT_TIMESTAMP::TEXT || 
    '. Database-level tenant isolation REMOVED. ' ||
    'Application-level security MUST be enforced until RLS is re-enabled!';

-- =============================================================================
-- SECURITY WARNING
-- =============================================================================

DO $$
BEGIN
    RAISE WARNING '═══════════════════════════════════════════════════════════';
    RAISE WARNING ' SECURITY NOTICE: RLS POLICIES HAVE BEEN REMOVED!';
    RAISE WARNING '═══════════════════════════════════════════════════════════';
    RAISE WARNING '';
    RAISE WARNING ' Database-level tenant isolation is NO LONGER ACTIVE!';
    RAISE WARNING ' All data is now accessible without RLS restrictions!';
    RAISE WARNING '';
    RAISE WARNING ' IMMEDIATE ACTIONS REQUIRED:';
    RAISE WARNING '  1. Verify application-level security is enforcing isolation';
    RAISE WARNING '  2. Monitor for unauthorized data access';
    RAISE WARNING '  3. Plan to re-enable RLS as soon as possible';
    RAISE WARNING '  4. Review all recent database queries for anomalies';
    RAISE WARNING '';
    RAISE WARNING '═══════════════════════════════════════════════════════════';
END $$;
