-- Migration: Add tenant-first indexes for high-volume tables per multi-tenant indexing strategy.
-- Expected predicates: WHERE organization_id = ? with filters on status/case_id and ORDER BY time DESC.
-- Column order keeps tenant scope first for selectivity and stable cursor pagination.

-- audit_logs: tenant-scoped audit timelines ordered by newest events.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_tenant_created_id
  ON public.audit_logs (tenant_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_org_created_id
  ON public.audit_logs (organization_id, created_at DESC, id DESC);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_audit_logs_tenant_created_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_audit_logs_org_created_id;

-- agent_runs: high-volume execution events filtered by status and ordered by recency.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_runs_tenant_status_created_id
  ON public.agent_runs (tenant_id, status, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_runs_org_status_created_id
  ON public.agent_runs (organization_id, status, created_at DESC, id DESC);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_agent_runs_tenant_status_created_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_agent_runs_org_status_created_id;

-- workflow_states: execution history filtered by status and ordered by started_at for cursor paging.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_states_tenant_status_started_id
  ON public.workflow_states (tenant_id, status, started_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_states_org_status_started_id
  ON public.workflow_states (organization_id, status, started_at DESC, id DESC);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_workflow_states_tenant_status_started_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_workflow_states_org_status_started_id;

-- shared_artifacts: tenant artifacts filtered by case and ordered by created_at.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shared_artifacts_tenant_case_created_at
  ON public.shared_artifacts (tenant_id, case_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shared_artifacts_org_case_created_at
  ON public.shared_artifacts (organization_id, case_id, created_at DESC);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF NOT EXISTS idx_shared_artifacts_tenant_case_created_at;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_shared_artifacts_org_case_created_at;

-- cases: tenant cases filtered by status and ordered by updated_at for recency lists.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_tenant_status_updated_id
  ON public.cases (tenant_id, status, updated_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_org_status_updated_id
  ON public.cases (organization_id, status, updated_at DESC, id DESC);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF NOT EXISTS idx_cases_tenant_status_updated_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_cases_org_status_updated_id;

-- Optional cleanup if organization_id-only indexes are deprecated.
-- DROP INDEX CONCURRENTLY IF EXISTS idx_audit_logs_org_created_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_agent_runs_org_status_created_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_workflow_states_org_status_started_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_shared_artifacts_org_case_created_at;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_cases_org_status_updated_id;
