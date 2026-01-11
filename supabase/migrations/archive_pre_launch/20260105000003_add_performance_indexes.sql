-- Add Performance Indexes
-- Purpose: Add missing composite indexes for RLS and query performance
-- Priority: HIGH
-- Ref: PRE_RELEASE_AUDIT_2026-01-05.md Issue #6

-- ============================================================================
-- 1. RLS Policy Join Tables - Critical for Performance
-- ============================================================================

-- user_organizations composite index for RLS policies
CREATE INDEX IF NOT EXISTS idx_user_organizations_user_org_active 
ON user_organizations(user_id, organization_id) 
WHERE status = 'active';

COMMENT ON INDEX idx_user_organizations_user_org_active IS 
  'Optimizes RLS policy lookups for active user-organization relationships';

-- user_tenants composite index for RLS policies
CREATE INDEX IF NOT EXISTS idx_user_tenants_user_tenant_active 
ON user_tenants(user_id, tenant_id) 
WHERE status = 'active';

COMMENT ON INDEX idx_user_tenants_user_tenant_active IS 
  'Optimizes RLS policy lookups for active user-tenant relationships';

-- ============================================================================
-- 2. Integration Tables
-- ============================================================================

-- integration_connections by organization and type
CREATE INDEX IF NOT EXISTS idx_integration_connections_org_type 
ON integration_connections(organization_id, adapter_type);

COMMENT ON INDEX idx_integration_connections_org_type IS 
  'Optimizes queries for integrations by organization and adapter type';

-- sync_history by connection and time
CREATE INDEX IF NOT EXISTS idx_sync_history_connection_time 
ON sync_history(connection_id, started_at DESC);

COMMENT ON INDEX idx_sync_history_connection_time IS 
  'Optimizes sync history queries by connection and time';

-- sync_history by status for monitoring
CREATE INDEX IF NOT EXISTS idx_sync_history_status_time 
ON sync_history(status, started_at DESC)
WHERE status IN ('running', 'failed');

COMMENT ON INDEX idx_sync_history_status_time IS 
  'Optimizes queries for active and failed syncs';

-- ============================================================================
-- 3. Audit Tables
-- ============================================================================

-- audit_logs by organization and time
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_time 
ON audit_logs(organization_id, created_at DESC);

COMMENT ON INDEX idx_audit_logs_org_time IS 
  'Optimizes audit log queries by organization and time';

-- audit_logs by user and time
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time 
ON audit_logs(user_id, created_at DESC);

COMMENT ON INDEX idx_audit_logs_user_time IS 
  'Optimizes audit log queries by user and time';

-- audit_logs by action and time
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_time 
ON audit_logs(action, created_at DESC);

COMMENT ON INDEX idx_audit_logs_action_time IS 
  'Optimizes audit log queries by action type and time';

-- security_audit_events by tenant and time
CREATE INDEX IF NOT EXISTS idx_security_audit_events_tenant_time 
ON security_audit_events(tenant_id, timestamp DESC);

COMMENT ON INDEX idx_security_audit_events_tenant_time IS 
  'Optimizes security audit queries by tenant and time';

-- security_audit_events by action
CREATE INDEX IF NOT EXISTS idx_security_audit_events_action 
ON security_audit_events(action, timestamp DESC);

COMMENT ON INDEX idx_security_audit_events_action IS 
  'Optimizes security audit queries by action type';

-- ============================================================================
-- 4. LLM Tables
-- ============================================================================

-- llm_gating_policies by tenant
CREATE INDEX IF NOT EXISTS idx_llm_gating_policies_tenant 
ON llm_gating_policies(tenant_id);

COMMENT ON INDEX idx_llm_gating_policies_tenant IS 
  'Optimizes LLM gating policy lookups by tenant';

-- llm_usage by tenant and time
CREATE INDEX IF NOT EXISTS idx_llm_usage_tenant_time 
ON llm_usage(tenant_id, created_at DESC);

COMMENT ON INDEX idx_llm_usage_tenant_time IS 
  'Optimizes LLM usage queries by tenant and time';

-- llm_usage by user and time
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_time 
ON llm_usage(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

COMMENT ON INDEX idx_llm_usage_user_time IS 
  'Optimizes LLM usage queries by user and time';

-- llm_usage by model for analytics
CREATE INDEX IF NOT EXISTS idx_llm_usage_model_time 
ON llm_usage(model, created_at DESC);

COMMENT ON INDEX idx_llm_usage_model_time IS 
  'Optimizes LLM usage analytics by model';

-- llm_calls by tenant (if tenant_id exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'llm_calls' AND column_name = 'tenant_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_llm_calls_tenant_time 
    ON llm_calls(tenant_id, created_at DESC);
  END IF;
END $$;

-- ============================================================================
-- 5. Agent Tables
-- ============================================================================

-- agent_sessions by tenant and time
CREATE INDEX IF NOT EXISTS idx_agent_sessions_tenant_time 
ON agent_sessions(tenant_id, created_at DESC);

COMMENT ON INDEX idx_agent_sessions_tenant_time IS 
  'Optimizes agent session queries by tenant and time';

-- agent_predictions by tenant and time
CREATE INDEX IF NOT EXISTS idx_agent_predictions_tenant_time 
ON agent_predictions(tenant_id, created_at DESC);

COMMENT ON INDEX idx_agent_predictions_tenant_time IS 
  'Optimizes agent prediction queries by tenant and time';

-- agent_memory by organization and session
CREATE INDEX IF NOT EXISTS idx_agent_memory_org_session 
ON agent_memory(organization_id, session_id);

COMMENT ON INDEX idx_agent_memory_org_session IS 
  'Optimizes agent memory queries by organization and session';

-- ============================================================================
-- 6. Archive Tables
-- ============================================================================

-- approval_requests_archive by tenant and time
CREATE INDEX IF NOT EXISTS idx_approval_requests_archive_tenant_time 
ON approval_requests_archive(tenant_id, created_at DESC)
WHERE tenant_id IS NOT NULL;

COMMENT ON INDEX idx_approval_requests_archive_tenant_time IS 
  'Optimizes archived approval request queries by tenant and time';

-- approvals_archive by tenant and time
CREATE INDEX IF NOT EXISTS idx_approvals_archive_tenant_time 
ON approvals_archive(tenant_id, created_at DESC)
WHERE tenant_id IS NOT NULL;

COMMENT ON INDEX idx_approvals_archive_tenant_time IS 
  'Optimizes archived approval queries by tenant and time';

-- ============================================================================
-- 7. JSONB Indexes for Configuration Queries
-- ============================================================================

-- integration_connections config
CREATE INDEX IF NOT EXISTS idx_integration_connections_config_gin 
ON integration_connections USING GIN (config);

COMMENT ON INDEX idx_integration_connections_config_gin IS 
  'Optimizes JSONB queries on integration configuration';

-- integration_connections field_mappings
CREATE INDEX IF NOT EXISTS idx_integration_connections_mappings_gin 
ON integration_connections USING GIN (field_mappings);

COMMENT ON INDEX idx_integration_connections_mappings_gin IS 
  'Optimizes JSONB queries on field mappings';

-- llm_gating_policies routing_rules
CREATE INDEX IF NOT EXISTS idx_llm_gating_policies_routing_gin 
ON llm_gating_policies USING GIN (routing_rules);

COMMENT ON INDEX idx_llm_gating_policies_routing_gin IS 
  'Optimizes JSONB queries on LLM routing rules';

-- llm_gating_policies manifesto_enforcement
CREATE INDEX IF NOT EXISTS idx_llm_gating_policies_manifesto_gin 
ON llm_gating_policies USING GIN (manifesto_enforcement);

COMMENT ON INDEX idx_llm_gating_policies_manifesto_gin IS 
  'Optimizes JSONB queries on manifesto enforcement configuration';

-- ============================================================================
-- 8. Foreign Key Indexes (if missing)
-- ============================================================================

-- integration_usage_log foreign keys
CREATE INDEX IF NOT EXISTS idx_integration_usage_log_integration 
ON integration_usage_log(integration_id);

CREATE INDEX IF NOT EXISTS idx_integration_usage_log_user 
ON integration_usage_log(user_id);

-- webhook_events tenant_id (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'webhook_events' AND column_name = 'tenant_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant 
    ON webhook_events(tenant_id);
  END IF;
END $$;

-- ============================================================================
-- 9. Time-Series Indexes (BRIN for large tables)
-- ============================================================================

-- audit_logs BRIN index for time-series queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_brin 
ON audit_logs USING BRIN (created_at);

COMMENT ON INDEX idx_audit_logs_created_at_brin IS 
  'BRIN index for efficient time-range queries on large audit log table';

-- llm_usage BRIN index for time-series queries
CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at_brin 
ON llm_usage USING BRIN (created_at);

COMMENT ON INDEX idx_llm_usage_created_at_brin IS 
  'BRIN index for efficient time-range queries on large LLM usage table';

-- sync_history BRIN index for time-series queries
CREATE INDEX IF NOT EXISTS idx_sync_history_started_at_brin 
ON sync_history USING BRIN (started_at);

COMMENT ON INDEX idx_sync_history_started_at_brin IS 
  'BRIN index for efficient time-range queries on large sync history table';

-- ============================================================================
-- 10. Analyze tables to update statistics
-- ============================================================================

ANALYZE user_organizations;
ANALYZE user_tenants;
ANALYZE integration_connections;
ANALYZE sync_history;
ANALYZE audit_logs;
ANALYZE security_audit_events;
ANALYZE llm_gating_policies;
ANALYZE llm_usage;
ANALYZE agent_sessions;
ANALYZE agent_predictions;

-- ============================================================================
-- Summary
-- ============================================================================

DO $$
DECLARE
  v_index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%';
  
  RAISE NOTICE 'Performance indexes migration complete. Total indexes: %', v_index_count;
END $$;
