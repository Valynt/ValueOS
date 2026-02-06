-- Migration: Add tenant-leading hot-path indexes for high-volume read/write tables
-- Authoritative path: infra/postgres/migrations

-- llm_usage: tenant usage dashboards and recent request pagination
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_llm_usage_tenant_endpoint_created_at
  ON public.llm_usage (tenant_id, endpoint, created_at DESC);
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_llm_usage_tenant_endpoint_created_at;

-- audit_logs: tenant-scoped compliance/event timelines (organization_id is tenant surrogate)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_org_action_created_at
  ON public.audit_logs (organization_id, action, created_at DESC);
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_audit_logs_org_action_created_at;

-- messages: tenant conversation stream filtered by case/workflow and paginated by recency
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_tenant_case_created_at
  ON public.messages (tenant_id, case_id, created_at DESC);
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_messages_tenant_case_created_at;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_tenant_workflow_created_at
  ON public.messages (tenant_id, workflow_id, created_at DESC);
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_messages_tenant_workflow_created_at;

-- opportunities: keep existing (value_case_id, tenant_id) index and add tenant-leading companion indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opportunities_tenant_value_case
  ON public.opportunities (tenant_id, value_case_id);
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_opportunities_tenant_value_case;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opportunities_tenant_status_created_at
  ON public.opportunities (tenant_id, status, created_at DESC);
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_opportunities_tenant_status_created_at;

-- value_cases: tenant list filters and recency sorting for dashboard/query pagination
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_value_cases_tenant_status_updated_at
  ON public.value_cases (tenant_id, status, updated_at DESC);
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_value_cases_tenant_status_updated_at;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_value_cases_tenant_session_created_at
  ON public.value_cases (tenant_id, session_id, created_at DESC);
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_value_cases_tenant_session_created_at;

-- cases: tenant-first conversation index for case list + status filters sorted by recency
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_tenant_status_updated_at
  ON public.cases (tenant_id, status, updated_at DESC);
-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS idx_cases_tenant_status_updated_at;
