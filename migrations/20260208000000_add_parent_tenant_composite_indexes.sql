-- No new tables created; no RLS action required in this migration.
-- Migration: Add parent-first tenant composite indexes for high-volume activity tables.
-- Mirrors the (value_case_id, tenant_id) strategy by pairing parent identifiers with tenant keys.
-- Uses CREATE INDEX CONCURRENTLY IF NOT EXISTS to minimize locking on high-volume tables.

-- audit_logs: parent resource lookups scoped by tenant surrogate (organization_id).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_org
  ON public.audit_logs (resource_id, organization_id);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_audit_logs_resource_org;

-- agent_runs: parent agent/user scoped runs by tenant.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_runs_agent_org
  ON public.agent_runs (agent_id, organization_id);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_agent_runs_agent_org;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_runs_user_org
  ON public.agent_runs (user_id, organization_id);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_agent_runs_user_org;

-- workflow_states: per-case or per-workflow histories scoped by tenant.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_states_case_org
  ON public.workflow_states (case_id, organization_id);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_workflow_states_case_org;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_states_workflow_org
  ON public.workflow_states (workflow_id, organization_id);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_workflow_states_workflow_org;

-- shared_artifacts: per-case artifacts scoped by tenant.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shared_artifacts_case_org
  ON public.shared_artifacts (case_id, organization_id);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_shared_artifacts_case_org;

-- cases: per-user case lists scoped by tenant.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cases_user_org
  ON public.cases (user_id, organization_id);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF NOT EXISTS idx_cases_user_org;

-- messages: per-case/workflow threads scoped by tenant.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_case_tenant
  ON public.messages (case_id, tenant_id);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_messages_case_tenant;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_workflow_tenant
  ON public.messages (workflow_id, tenant_id);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_messages_workflow_tenant;
