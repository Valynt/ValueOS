-- Database Performance Optimization
-- Indexes and optimizations for ValueOS lifecycle operations

-- 2026-03-19 canonical audit note:
--   This file is a legacy ad-hoc optimization bundle, not the deployable
--   migration source of truth. Canonical, repeatable indexes now live in
--   infra/supabase/supabase/migrations/, including:
--     * 20260331050000_transaction_hot_path_indexes.sql
--     * 20260331051000_semantic_memory_hot_path_indexes.sql
--   Remaining statements below mostly target legacy tables that are not part
--   of the active Supabase migration chain and should be promoted only through
--   versioned migrations after schema verification.

-- Opportunity stage optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opportunity_results_user_created
ON opportunity_results (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opportunity_results_session
ON opportunity_results (session_id);

-- Target stage optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_target_results_user_created
ON target_results (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_target_results_session
ON target_results (session_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_target_results_opportunity_id
ON target_results (opportunity_result_id);

-- Expansion stage optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expansion_results_user_created
ON expansion_results (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expansion_results_session
ON expansion_results (session_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expansion_results_value_tree_id
ON expansion_results (value_tree_id);

-- Integrity stage optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrity_results_user_created
ON integrity_results (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrity_results_session
ON integrity_results (session_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrity_results_roi_model_id
ON integrity_results (roi_model_id);

-- Realization stage optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_realization_results_user_created
ON realization_results (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_realization_results_session
ON realization_results (session_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_realization_results_value_commit_id
ON realization_results (value_commit_id);

-- Telemetry and audit optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_telemetry_events_agent_type_timestamp
ON agent_telemetry_events (agent_type, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_telemetry_events_session
ON agent_telemetry_events (session_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_telemetry_events_severity
ON agent_telemetry_events (severity);

-- Agent execution traces optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_execution_traces_agent_type_start_time
ON agent_execution_traces (agent_type, start_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_execution_traces_session
ON agent_execution_traces (session_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_execution_traces_status
ON agent_execution_traces (status);

-- Audit logs optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_agent_type_timestamp
ON audit_logs (agent_type, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_session_user
ON audit_logs (session_id, user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_operation_type
ON audit_logs (operation_type);

-- Memory system optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_entries_type_timestamp
ON memory_entries (type, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_entries_session
ON memory_entries (session_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_entries_user
ON memory_entries (user_id);

-- Workflow execution optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_user_created
ON workflow_executions (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_status
ON workflow_executions (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_organization
ON workflow_executions (organization_id);

-- Partial indexes for active workflows
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_active
ON workflow_executions (created_at DESC)
WHERE status NOT IN ('completed', 'failed', 'cancelled');

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opportunity_target_link
ON target_results (opportunity_result_id, user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_target_expansion_link
ON expansion_results (target_result_id, user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expansion_integrity_link
ON integrity_results (expansion_result_id, user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrity_realization_link
ON realization_results (integrity_result_id, user_id, created_at DESC);

-- JSONB indexes for metadata fields
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opportunity_results_metadata_gin
ON opportunity_results USING GIN (metadata);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_target_results_metadata_gin
ON target_results USING GIN (metadata);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expansion_results_metadata_gin
ON expansion_results USING GIN (metadata);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrity_results_metadata_gin
ON integrity_results USING GIN (metadata);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_realization_results_metadata_gin
ON realization_results USING GIN (metadata);

-- Function to analyze table bloat and suggest optimizations
CREATE OR REPLACE FUNCTION analyze_table_bloat()
RETURNS TABLE (
  schemaname text,
  tablename text,
  estimated_bloat_bytes bigint,
  estimated_bloat_ratio numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.schemaname::text,
    ps.tablename::text,
    (ps.n_dead_tup * avg_width)::bigint as estimated_bloat_bytes,
    round(
      (ps.n_dead_tup::numeric / (ps.n_live_tup + ps.n_dead_tup) * 100)::numeric,
      2
    ) as estimated_bloat_ratio
  FROM pg_stat_user_tables ps
  JOIN pg_class pc ON ps.relname = pc.relname
  JOIN (
    SELECT tablename, avg_width
    FROM pg_stats
    WHERE schemaname = 'public'
  ) st ON ps.relname = st.tablename
  WHERE ps.schemaname = 'public'
    AND ps.n_dead_tup > 0
  ORDER BY estimated_bloat_bytes DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get query performance metrics
CREATE OR REPLACE FUNCTION get_query_performance_metrics(hours_back int DEFAULT 24)
RETURNS TABLE (
  query text,
  calls bigint,
  total_time numeric,
  mean_time numeric,
  rows_affected bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    substring(query, 1, 100) as query,
    calls,
    total_time,
    mean_time,
    rows as rows_affected
  FROM pg_stat_statements
  WHERE calls > 10
    AND query_start > NOW() - INTERVAL '1 hour' * hours_back
  ORDER BY mean_time DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Partitioning strategy for high-volume tables (if needed)
-- Note: Implement partitioning for tables exceeding 100M rows

-- Example partitioning for agent_telemetry_events (if high volume)
-- CREATE TABLE agent_telemetry_events_y2024m01 PARTITION OF agent_telemetry_events
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Connection pool configuration recommendations
-- max_connections = 200
-- shared_preload_libraries = 'pg_stat_statements'
-- pg_stat_statements.max = 10000
-- pg_stat_statements.track = all
-- work_mem = '64MB'
-- maintenance_work_mem = '256MB'
-- checkpoint_completion_target = 0.9
-- wal_buffers = '16MB'
-- default_statistics_target = 100
