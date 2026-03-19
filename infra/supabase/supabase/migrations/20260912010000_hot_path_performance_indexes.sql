-- Canonical hot-path performance indexes
--
-- Purpose:
--   Promote the remaining high-value indexes that were previously only captured
--   in the ad hoc scripts/database-performance-optimization.sql inventory.
--
-- Review summary:
--   * semantic_memory is the canonical replacement for legacy memory_entries.
--   * workflow_executions already had baseline status indexes, but its active
--     working-set path still lacked a dedicated partial index.
--   * audit_logs hot paths in production are tenant/resource evidence queries
--     and organization/action freshness queries, not the legacy ad hoc
--     agent_type / operation_type access patterns from the inventory script.
--
-- These indexes are intentionally tenant-leading wherever the active query
-- shape starts with organization_id or tenant_id.

SET search_path = public, pg_temp;

-- semantic_memory
-- Query shape:
--   organization_id = $1 AND type = $2 ORDER BY created_at DESC
-- Dependent services:
--   - packages/backend/src/lib/memory/SupabaseSemanticStore.ts
--   - packages/backend/src/services/tenant/TenantContextIngestionService.ts
CREATE INDEX IF NOT EXISTS idx_semantic_memory_org_type_created
  ON public.semantic_memory (organization_id, type, created_at DESC);

-- workflow_executions
-- Query shape:
--   organization_id = $1
--   AND status IN ('pending', 'in_progress', 'waiting_approval')
--   ORDER BY created_at DESC
-- Dependent services:
--   - packages/backend/src/services/workflow/HumanCheckpointService.ts
--   - packages/backend/src/services/workflow/WorkflowCompensation.ts
--   - packages/backend/src/services/workflows/WorkflowDAGIntegration.ts
CREATE INDEX IF NOT EXISTS idx_workflow_executions_org_active_created
  ON public.workflow_executions (organization_id, created_at DESC)
  WHERE status IN ('pending', 'in_progress', 'waiting_approval');

-- workflow_execution_logs
-- Query shape:
--   organization_id = $1 AND execution_id = $2 ORDER BY created_at ASC|DESC
-- Dependent services:
--   - packages/backend/src/services/workflows/WorkflowExecutionStore.ts
--   - packages/backend/src/services/workflow/WorkflowCompensation.ts
--   - packages/backend/src/runtime/context-store/index.ts
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_org_execution_created
  ON public.workflow_execution_logs (organization_id, execution_id, created_at DESC);

-- audit_logs
-- Query shape:
--   tenant_id = $1 AND resource_type = $2
--   AND timestamp BETWEEN $3 AND $4 ORDER BY timestamp DESC
-- Dependent services:
--   - packages/backend/src/services/security/ComplianceEvidenceService.ts
--   - packages/backend/src/services/security/ComplianceReportGeneratorService.ts
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_resource_timestamp
  ON public.audit_logs (tenant_id, resource_type, timestamp DESC);

-- audit_logs
-- Query shape:
--   organization_id = $1 AND action IN (...) ORDER BY created_at DESC
-- Dependent services:
--   - packages/backend/src/services/security/ComplianceControlStatusService.ts
--   - packages/backend/src/services/security/AuditLogService.ts
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_action_created
  ON public.audit_logs (organization_id, action, created_at DESC);
