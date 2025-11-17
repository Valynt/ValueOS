/*
  # Rollback for Extended Workflow, Provenance, and Performance Schema

  Safely removes the extended schema objects introduced in the provenance tracking,
  workflow orchestration extension, and performance optimization migrations.

  ## Order of operations
  1. Drop policies and indexes
  2. Drop helper functions
  3. Remove added columns
  4. Drop newly created tables

  Run only in development or with verified backups because data in the dropped
  tables and columns will be permanently deleted.
*/

-- =====================================================
-- STEP 1: Drop policies and indexes
-- =====================================================

DROP POLICY IF EXISTS "Users can manage own performance metrics" ON performance_metrics;

-- Indexes from provenance tracking
DROP INDEX IF EXISTS idx_lifecycle_links_source;
DROP INDEX IF EXISTS idx_lifecycle_links_target;
DROP INDEX IF EXISTS idx_lifecycle_links_session;
DROP INDEX IF EXISTS idx_provenance_audit_session;
DROP INDEX IF EXISTS idx_provenance_audit_artifact;

-- Indexes from workflow audit extension
DROP INDEX IF EXISTS idx_workflow_audit_execution;
DROP INDEX IF EXISTS idx_workflow_audit_created;

-- Indexes from performance optimization
DROP INDEX IF EXISTS idx_value_cases_lifecycle_stage;
DROP INDEX IF EXISTS idx_agent_sessions_user_status;
DROP INDEX IF EXISTS idx_agent_sessions_started_at;
DROP INDEX IF EXISTS idx_agent_metrics_timestamp;
DROP INDEX IF EXISTS idx_workflow_executions_started_at;
DROP INDEX IF EXISTS idx_value_tree_nodes_created_at;
DROP INDEX IF EXISTS idx_performance_metrics_session;
DROP INDEX IF EXISTS idx_performance_metrics_agent;
DROP INDEX IF EXISTS idx_performance_metrics_created;
DROP INDEX IF EXISTS idx_performance_metrics_duration;

-- =====================================================
-- STEP 2: Drop helper functions
-- =====================================================

DROP FUNCTION IF EXISTS get_value_tree_hierarchy(uuid, integer);

-- =====================================================
-- STEP 3: Remove added columns
-- =====================================================

ALTER TABLE workflow_executions DROP COLUMN IF EXISTS workflow_version;
ALTER TABLE workflow_executions DROP COLUMN IF EXISTS audit_context;
ALTER TABLE workflow_execution_logs DROP COLUMN IF EXISTS retry_policy;

ALTER TABLE roi_model_calculations DROP COLUMN IF EXISTS input_variables;
ALTER TABLE roi_model_calculations DROP COLUMN IF EXISTS source_references;
ALTER TABLE roi_model_calculations DROP COLUMN IF EXISTS reasoning_trace;

ALTER TABLE value_cases DROP COLUMN IF EXISTS lifecycle_stage;

-- =====================================================
-- STEP 4: Drop tables created by extended schema migrations
-- =====================================================

DROP TABLE IF EXISTS workflow_audit_logs CASCADE;
DROP TABLE IF EXISTS performance_metrics CASCADE;
DROP TABLE IF EXISTS lifecycle_artifact_links CASCADE;
DROP TABLE IF EXISTS provenance_audit_log CASCADE;

-- =====================================================
-- Rollback complete
-- =====================================================
