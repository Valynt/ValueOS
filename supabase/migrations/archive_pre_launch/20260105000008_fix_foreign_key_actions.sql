-- Fix Foreign Key Delete Actions
-- Purpose: Add ON DELETE actions to 19 foreign keys
-- Priority: HIGH
-- Ref: PRE_RELEASE_AUDIT_2026-01-05.md Issue #9

-- ============================================================================
-- ISSUE: 19 foreign keys lack explicit ON DELETE actions
-- 
-- Risk: Orphaned records, failed deletions, data integrity issues
-- Solution: Add appropriate ON DELETE actions based on relationship type
-- 
-- Categories:
-- - CASCADE: Dependent data (should be deleted with parent)
-- - SET NULL: Audit/history references (preserve record, null reference)
-- - RESTRICT: Critical references (prevent deletion if referenced)
-- ============================================================================

-- ============================================================================
-- Category 1: CASCADE - Dependent Data
-- These records are meaningless without their parent
-- ============================================================================

-- 1. cases_tenant_id_fkey
-- Cases belong to tenants, should be deleted with tenant
ALTER TABLE cases
DROP CONSTRAINT IF EXISTS cases_tenant_id_fkey,
ADD CONSTRAINT cases_tenant_id_fkey 
  FOREIGN KEY (tenant_id) 
  REFERENCES tenants(id) 
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT cases_tenant_id_fkey ON cases IS 
  'Cases are deleted when tenant is deleted (CASCADE)';

-- 2. messages_tenant_id_fkey
-- Messages belong to tenants, should be deleted with tenant
ALTER TABLE messages
DROP CONSTRAINT IF EXISTS messages_tenant_id_fkey,
ADD CONSTRAINT messages_tenant_id_fkey 
  FOREIGN KEY (tenant_id) 
  REFERENCES tenants(id) 
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT messages_tenant_id_fkey ON messages IS 
  'Messages are deleted when tenant is deleted (CASCADE)';

-- 3. workflows_tenant_id_fkey
-- Workflows belong to tenants, should be deleted with tenant
ALTER TABLE workflows
DROP CONSTRAINT IF EXISTS workflows_tenant_id_fkey,
ADD CONSTRAINT workflows_tenant_id_fkey 
  FOREIGN KEY (tenant_id) 
  REFERENCES tenants(id) 
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT workflows_tenant_id_fkey ON workflows IS 
  'Workflows are deleted when tenant is deleted (CASCADE)';

-- 4. integration_usage_log_integration_id_fkey
-- Usage logs belong to integration, should be deleted with integration
ALTER TABLE integration_usage_log
DROP CONSTRAINT IF EXISTS integration_usage_log_integration_id_fkey,
ADD CONSTRAINT integration_usage_log_integration_id_fkey 
  FOREIGN KEY (integration_id) 
  REFERENCES tenant_integrations(id) 
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT integration_usage_log_integration_id_fkey ON integration_usage_log IS 
  'Usage logs are deleted when integration is deleted (CASCADE)';

-- 5. agent_metrics_agent_id_fkey
-- Metrics belong to agent, should be deleted with agent
ALTER TABLE agent_metrics
DROP CONSTRAINT IF EXISTS agent_metrics_agent_id_fkey,
ADD CONSTRAINT agent_metrics_agent_id_fkey 
  FOREIGN KEY (agent_id) 
  REFERENCES agents(id) 
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT agent_metrics_agent_id_fkey ON agent_metrics IS 
  'Metrics are deleted when agent is deleted (CASCADE)';

-- 6. agent_predictions_calibration_model_id_fkey
-- Predictions belong to calibration model, should be deleted with model
ALTER TABLE agent_predictions
DROP CONSTRAINT IF EXISTS agent_predictions_calibration_model_id_fkey,
ADD CONSTRAINT agent_predictions_calibration_model_id_fkey 
  FOREIGN KEY (calibration_model_id) 
  REFERENCES agent_calibration_models(id) 
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT agent_predictions_calibration_model_id_fkey ON agent_predictions IS 
  'Predictions are deleted when calibration model is deleted (CASCADE)';

-- 7. task_queue_agent_id_fkey
-- Tasks belong to agent, should be deleted with agent
ALTER TABLE task_queue
DROP CONSTRAINT IF EXISTS task_queue_agent_id_fkey,
ADD CONSTRAINT task_queue_agent_id_fkey 
  FOREIGN KEY (agent_id) 
  REFERENCES agents(id) 
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT task_queue_agent_id_fkey ON task_queue IS 
  'Tasks are deleted when agent is deleted (CASCADE)';

-- 8. message_bus_from_agent_id_fkey
-- Messages from agent should be deleted with agent
ALTER TABLE message_bus
DROP CONSTRAINT IF EXISTS message_bus_from_agent_id_fkey,
ADD CONSTRAINT message_bus_from_agent_id_fkey 
  FOREIGN KEY (from_agent_id) 
  REFERENCES agents(id) 
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT message_bus_from_agent_id_fkey ON message_bus IS 
  'Messages are deleted when sender agent is deleted (CASCADE)';

-- 9. message_bus_to_agent_id_fkey
-- Messages to agent should be deleted with agent
ALTER TABLE message_bus
DROP CONSTRAINT IF EXISTS message_bus_to_agent_id_fkey,
ADD CONSTRAINT message_bus_to_agent_id_fkey 
  FOREIGN KEY (to_agent_id) 
  REFERENCES agents(id) 
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT message_bus_to_agent_id_fkey ON message_bus IS 
  'Messages are deleted when recipient agent is deleted (CASCADE)';

-- 10. approver_roles_user_id_fkey
-- Approver roles belong to user, should be deleted with user
ALTER TABLE approver_roles
DROP CONSTRAINT IF EXISTS approver_roles_user_id_fkey,
ADD CONSTRAINT approver_roles_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT approver_roles_user_id_fkey ON approver_roles IS 
  'Approver roles are deleted when user is deleted (CASCADE)';

-- ============================================================================
-- Category 2: SET NULL - Audit/History References
-- These records should be preserved, but reference can be nulled
-- ============================================================================

-- 11. agent_audit_log_agent_id_fkey
-- Audit logs should be preserved even if agent is deleted
ALTER TABLE agent_audit_log
DROP CONSTRAINT IF EXISTS agent_audit_log_agent_id_fkey,
ADD CONSTRAINT agent_audit_log_agent_id_fkey 
  FOREIGN KEY (agent_id) 
  REFERENCES agents(id) 
  ON DELETE SET NULL;

COMMENT ON CONSTRAINT agent_audit_log_agent_id_fkey ON agent_audit_log IS 
  'Audit logs preserved when agent deleted, reference nulled (SET NULL)';

-- 12. audit_logs_user_id_fkey
-- Audit logs should be preserved even if user is deleted
ALTER TABLE audit_logs
DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey,
ADD CONSTRAINT audit_logs_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

COMMENT ON CONSTRAINT audit_logs_user_id_fkey ON audit_logs IS 
  'Audit logs preserved when user deleted, reference nulled (SET NULL)';

-- 13. approval_requests_requester_id_fkey
-- Approval requests should be preserved for audit trail
ALTER TABLE approval_requests
DROP CONSTRAINT IF EXISTS approval_requests_requester_id_fkey,
ADD CONSTRAINT approval_requests_requester_id_fkey 
  FOREIGN KEY (requester_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

COMMENT ON CONSTRAINT approval_requests_requester_id_fkey ON approval_requests IS 
  'Approval requests preserved when requester deleted, reference nulled (SET NULL)';

-- 14. approvals_approver_id_fkey
-- Approvals should be preserved for audit trail
ALTER TABLE approvals
DROP CONSTRAINT IF EXISTS approvals_approver_id_fkey,
ADD CONSTRAINT approvals_approver_id_fkey 
  FOREIGN KEY (approver_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

COMMENT ON CONSTRAINT approvals_approver_id_fkey ON approvals IS 
  'Approvals preserved when approver deleted, reference nulled (SET NULL)';

-- 15. approvals_second_approver_id_fkey
-- Second approvals should be preserved for audit trail
ALTER TABLE approvals
DROP CONSTRAINT IF EXISTS approvals_second_approver_id_fkey,
ADD CONSTRAINT approvals_second_approver_id_fkey 
  FOREIGN KEY (second_approver_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

COMMENT ON CONSTRAINT approvals_second_approver_id_fkey ON approvals IS 
  'Approvals preserved when second approver deleted, reference nulled (SET NULL)';

-- 16. approver_roles_granted_by_fkey
-- Role grants should be preserved for audit trail
ALTER TABLE approver_roles
DROP CONSTRAINT IF EXISTS approver_roles_granted_by_fkey,
ADD CONSTRAINT approver_roles_granted_by_fkey 
  FOREIGN KEY (granted_by) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

COMMENT ON CONSTRAINT approver_roles_granted_by_fkey ON approver_roles IS 
  'Role grants preserved when granter deleted, reference nulled (SET NULL)';

-- 17. integration_usage_log_user_id_fkey
-- Usage logs should be preserved for audit trail
ALTER TABLE integration_usage_log
DROP CONSTRAINT IF EXISTS integration_usage_log_user_id_fkey,
ADD CONSTRAINT integration_usage_log_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

COMMENT ON CONSTRAINT integration_usage_log_user_id_fkey ON integration_usage_log IS 
  'Usage logs preserved when user deleted, reference nulled (SET NULL)';

-- 18. tenant_integrations_connected_by_fkey
-- Integration connections should be preserved, but track who connected
ALTER TABLE tenant_integrations
DROP CONSTRAINT IF EXISTS tenant_integrations_connected_by_fkey,
ADD CONSTRAINT tenant_integrations_connected_by_fkey 
  FOREIGN KEY (connected_by) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

COMMENT ON CONSTRAINT tenant_integrations_connected_by_fkey ON tenant_integrations IS 
  'Integrations preserved when connector deleted, reference nulled (SET NULL)';

-- 19. resource_artifacts_replaced_by_fkey
-- Artifact replacement history should be preserved
ALTER TABLE resource_artifacts
DROP CONSTRAINT IF EXISTS resource_artifacts_replaced_by_fkey,
ADD CONSTRAINT resource_artifacts_replaced_by_fkey 
  FOREIGN KEY (replaced_by) 
  REFERENCES resource_artifacts(id) 
  ON DELETE SET NULL;

COMMENT ON CONSTRAINT resource_artifacts_replaced_by_fkey ON resource_artifacts IS 
  'Artifacts preserved when replacement deleted, reference nulled (SET NULL)';

-- ============================================================================
-- Create view to audit FK actions
-- ============================================================================

CREATE OR REPLACE VIEW foreign_key_actions_audit AS
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule,
  rc.update_rule,
  CASE 
    WHEN rc.delete_rule IS NULL THEN '❌ NO ACTION'
    WHEN rc.delete_rule = 'NO ACTION' THEN '⚠️ NO ACTION'
    WHEN rc.delete_rule = 'CASCADE' THEN '✅ CASCADE'
    WHEN rc.delete_rule = 'SET NULL' THEN '✅ SET NULL'
    WHEN rc.delete_rule = 'RESTRICT' THEN '✅ RESTRICT'
    ELSE '⚠️ ' || rc.delete_rule
  END as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
  AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY 
  CASE 
    WHEN rc.delete_rule IS NULL THEN 0
    WHEN rc.delete_rule = 'NO ACTION' THEN 1
    ELSE 2
  END,
  tc.table_name;

COMMENT ON VIEW foreign_key_actions_audit IS 
  'Audits foreign key delete actions (should show all with actions after migration)';

GRANT SELECT ON foreign_key_actions_audit TO authenticated;

-- ============================================================================
-- Create function to test FK behavior
-- ============================================================================

CREATE OR REPLACE FUNCTION test_foreign_key_cascade()
RETURNS TABLE(
  constraint_name TEXT,
  table_name TEXT,
  delete_rule TEXT,
  test_result TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tc.constraint_name::TEXT,
    tc.table_name::TEXT,
    rc.delete_rule::TEXT,
    CASE 
      WHEN rc.delete_rule = 'CASCADE' THEN '✅ Will delete dependent records'
      WHEN rc.delete_rule = 'SET NULL' THEN '✅ Will null reference'
      WHEN rc.delete_rule = 'RESTRICT' THEN '✅ Will prevent deletion'
      WHEN rc.delete_rule = 'NO ACTION' THEN '⚠️ May cause errors'
      ELSE '❌ No action defined'
    END::TEXT
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
    AND rc.constraint_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
  ORDER BY tc.table_name, tc.constraint_name;
END;
$$;

COMMENT ON FUNCTION test_foreign_key_cascade IS 
  'Tests and reports foreign key cascade behavior';

GRANT EXECUTE ON FUNCTION test_foreign_key_cascade TO authenticated;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  v_total_fks INTEGER;
  v_with_actions INTEGER;
  v_without_actions INTEGER;
  v_cascade_count INTEGER;
  v_set_null_count INTEGER;
BEGIN
  -- Count total FKs
  SELECT COUNT(*) INTO v_total_fks
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
  AND table_schema = 'public';
  
  -- Count FKs with actions
  SELECT COUNT(*) INTO v_with_actions
  FROM information_schema.referential_constraints
  WHERE constraint_schema = 'public'
  AND delete_rule != 'NO ACTION';
  
  -- Count FKs without actions
  SELECT COUNT(*) INTO v_without_actions
  FROM information_schema.referential_constraints
  WHERE constraint_schema = 'public'
  AND delete_rule = 'NO ACTION';
  
  -- Count CASCADE
  SELECT COUNT(*) INTO v_cascade_count
  FROM information_schema.referential_constraints
  WHERE constraint_schema = 'public'
  AND delete_rule = 'CASCADE';
  
  -- Count SET NULL
  SELECT COUNT(*) INTO v_set_null_count
  FROM information_schema.referential_constraints
  WHERE constraint_schema = 'public'
  AND delete_rule = 'SET NULL';
  
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Foreign Key Actions Migration Complete';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Total foreign keys: %', v_total_fks;
  RAISE NOTICE 'With explicit actions: %', v_with_actions;
  RAISE NOTICE 'Without actions (NO ACTION): %', v_without_actions;
  RAISE NOTICE '';
  RAISE NOTICE 'Breakdown:';
  RAISE NOTICE '  CASCADE: %', v_cascade_count;
  RAISE NOTICE '  SET NULL: %', v_set_null_count;
  RAISE NOTICE '';
  
  IF v_without_actions = 0 THEN
    RAISE NOTICE '✅ All foreign keys have explicit delete actions';
  ELSE
    RAISE WARNING '⚠️  % foreign keys still have NO ACTION', v_without_actions;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Verification:';
  RAISE NOTICE '  SELECT * FROM foreign_key_actions_audit WHERE status LIKE ''❌%%'';';
  RAISE NOTICE '  SELECT * FROM test_foreign_key_cascade();';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
END $$;
