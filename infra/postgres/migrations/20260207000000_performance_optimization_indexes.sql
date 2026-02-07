-- Migration: Add optimized composite indexes for high-volume multi-tenant queries
-- Performance optimization for ValueOS agent orchestration latency reduction
-- Authoritative path: infra/supabase/migrations

-- ============================================================================
-- Opportunities Table Indexes
-- ============================================================================

-- Hot-path: Tenant-scoped opportunity queries with amount sorting (dashboard views)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opportunities_tenant_created_at_amount
  ON public.opportunities (tenant_id, created_at DESC, amount DESC)
  WHERE tenant_id IS NOT NULL;
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_opportunities_tenant_created_at_amount;

-- Hot-path: Tenant + status + value_case for opportunity pipeline analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opportunities_tenant_status_value_case
  ON public.opportunities (tenant_id, status, value_case_id)
  WHERE tenant_id IS NOT NULL;
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_opportunities_tenant_status_value_case;

-- Hot-path: Tenant + amount range queries for opportunity sizing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opportunities_tenant_amount_created_at
  ON public.opportunities (tenant_id, amount DESC, created_at DESC)
  WHERE tenant_id IS NOT NULL AND amount IS NOT NULL;
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_opportunities_tenant_amount_created_at;

-- ============================================================================
-- Agent Metrics Table Indexes
-- ============================================================================

-- Hot-path: Tenant + metric_type + time range for analytics dashboards
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_metrics_tenant_type_created_at
  ON public.agent_metrics (tenant_id, metric_type, created_at DESC)
  WHERE tenant_id IS NOT NULL;
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_agent_metrics_tenant_type_created_at;

-- Hot-path: Tenant + session + time for session-based metric analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_metrics_tenant_session_created_at
  ON public.agent_metrics (tenant_id, session_id, created_at DESC)
  WHERE tenant_id IS NOT NULL AND session_id IS NOT NULL;
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_agent_metrics_tenant_session_created_at;

-- Hot-path: Tenant + agent + time for agent performance monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_metrics_tenant_agent_created_at
  ON public.agent_metrics (tenant_id, agent_id, created_at DESC)
  WHERE tenant_id IS NOT NULL AND agent_id IS NOT NULL;
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_agent_metrics_tenant_agent_created_at;

-- Hot-path: High-value metrics filtering (metric_value > threshold)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_metrics_tenant_value_created_at
  ON public.agent_metrics (tenant_id, metric_value DESC, created_at DESC)
  WHERE tenant_id IS NOT NULL AND metric_value > 0;
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_agent_metrics_tenant_value_created_at;

-- ============================================================================
-- Additional Performance Indexes
-- ============================================================================

-- Workflow execution performance: tenant + status + created for workflow dashboards
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_executions_tenant_status_created_at
  ON public.workflow_executions (tenant_id, status, created_at DESC)
  WHERE tenant_id IS NOT NULL;
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_workflow_executions_tenant_status_created_at;

-- Agent runs performance: tenant + agent_type + created for agent monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_runs_tenant_type_created_at
  ON public.agent_runs (tenant_id, agent_type, created_at DESC)
  WHERE tenant_id IS NOT NULL;
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_agent_runs_tenant_type_created_at;

-- ============================================================================
-- Index Maintenance
-- ============================================================================

-- Analyze tables after index creation for query planner optimization
ANALYZE public.opportunities;
ANALYZE public.agent_metrics;
ANALYZE public.workflow_executions;
ANALYZE public.agent_runs;
