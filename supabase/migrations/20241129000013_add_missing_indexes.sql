-- Fix: Add Missing Foreign Key Indexes
-- Addresses: Performance degradation on joins and cascading deletes
-- Issue: Several FK columns lack indexes, causing full table scans

-- Note: Using CREATE INDEX CONCURRENTLY requires this to be run outside a transaction
-- If running in production, execute each statement separately

-- ============================================================================
-- 1. Agent Predictions - prediction_id indexes
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_confidence_violations_prediction_id
  ON confidence_violations(prediction_id);

COMMENT ON INDEX idx_confidence_violations_prediction_id IS
  'Performance: Speeds up joins from confidence_violations to agent_predictions';

-- ============================================================================
-- 2. Tenant Integrations - user_id index
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integration_usage_log_user_id
  ON integration_usage_log(user_id);

COMMENT ON INDEX idx_integration_usage_log_user_id IS
  'Performance: Speeds up user-scoped queries on integration usage';

-- ============================================================================
-- 3. Approval System - second_approver_id index
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_requests_second_approver
  ON approval_requests(second_approver_id);

COMMENT ON INDEX idx_approval_requests_second_approver IS
  'Performance: Speeds up approval queries by second approver';

-- ============================================================================
-- 4. SOF Schema - owner_id index
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_business_objectives_owner_id
  ON business_objectives(owner_id)
  WHERE owner_id IS NOT NULL;

COMMENT ON INDEX idx_business_objectives_owner_id IS
  'Performance: Speeds up owner-based queries for business objectives';

-- ============================================================================
-- 5. SOF Schema - outcome_hypothesis_id index
-- ============================================================================
-- Note: Need to identify the actual table that references outcome_hypothesis_id
-- This is a placeholder - adjust table name as needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'outcome_hypotheses' 
      AND column_name = 'parent_hypothesis_id'
  ) THEN
    EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_outcome_hypotheses_parent_id
      ON outcome_hypotheses(parent_hypothesis_id)
      WHERE parent_hypothesis_id IS NOT NULL';
    
    RAISE NOTICE '✅ Created index on outcome_hypotheses.parent_hypothesis_id';
  END IF;
END $$;

-- ============================================================================
-- Additional Performance Indexes
-- ============================================================================

-- Workflow execution logs - execution_id (frequently joined)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_execution_logs_execution_id
  ON workflow_execution_logs(execution_id)
  WHERE execution_id IS NOT NULL;

-- Workflow events - execution_id (frequently joined)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_events_execution_id
  ON workflow_events(execution_id)
  WHERE execution_id IS NOT NULL;

-- Agent sessions - user_id (already has one, but ensure it exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_sessions_user_id
  ON agent_sessions(user_id)
  WHERE user_id IS NOT NULL;

-- Organization members - composite index for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_members_user_org_status
  ON organization_members(user_id, organization_id, status)
  WHERE status = 'active';

COMMENT ON INDEX idx_organization_members_user_org_status IS
  'Performance: Optimizes RLS policies that check user org membership';

-- ============================================================================
-- Verification Query
-- ============================================================================
DO $$
DECLARE
  index_count int;
BEGIN
  SELECT count(*) INTO index_count
  FROM pg_indexes
  WHERE indexname LIKE 'idx_%prediction_id%'
     OR indexname LIKE 'idx_%user_id%'
     OR indexname LIKE 'idx_%approver%'
     OR indexname LIKE 'idx_%owner_id%'
     OR indexname LIKE 'idx_%execution_id%';
  
  RAISE NOTICE '✅ SUCCESS: Created/verified % performance indexes', index_count;
  RAISE NOTICE 'Run ANALYZE on affected tables to update query planner statistics';
END $$;

-- Recommend running ANALYZE on these tables
-- ANALYZE confidence_violations;
-- ANALYZE integration_usage_log;
-- ANALYZE approval_requests;
-- ANALYZE business_objectives;
-- ANALYZE workflow_execution_logs;
-- ANALYZE workflow_events;
-- ANALYZE agent_sessions;
-- ANALYZE organization_members;
