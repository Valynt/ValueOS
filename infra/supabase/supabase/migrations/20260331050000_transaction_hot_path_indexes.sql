-- Transaction hot-path performance indexes.
--
-- Audit source: scripts/database-performance-optimization.sql (legacy ad-hoc
-- index bundle).
--
-- Findings from the audit:
--   * The legacy script proposed standalone workflow_executions status/org
--     indexes plus an active-workflow partial index. The canonical chain only
--     promoted idx_workflow_executions_org_status and idx_workflow_executions_case_created.
--   * The highest-volume transactional backlog today is usage_events
--     aggregation, which was not covered by the legacy script and still relied
--     on an outdated aggregated=false index even though the production worker
--     scans processed=false ordered by timestamp.
--   * WorkflowExecutionStore reads workflow_execution_logs by
--     (organization_id, execution_id) ordered by created_at, but only separate
--     execution_id and organization_id indexes existed.
--
-- This migration adds tenant-leading, repeatable indexes for those canonical
-- query shapes.

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- usage_events
-- Query shape:
--   WHERE processed = false
--   ORDER BY timestamp ASC
--   LIMIT 10000
-- Services:
--   - packages/backend/src/services/metering/UsageAggregator.ts
--   - packages/backend/src/services/billing/MetricsCollector.ts
--   - packages/backend/src/services/metering/UsageQueueConsumerWorker.ts
-- Notes:
--   This complements the existing idempotency/request uniqueness indexes by
--   accelerating the aggregation backlog scan itself.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_usage_events_unprocessed_timestamp
  ON public.usage_events (timestamp ASC)
  WHERE processed = false;

COMMENT ON INDEX public.idx_usage_events_unprocessed_timestamp IS
  'UsageAggregator backlog scan: WHERE processed=false ORDER BY timestamp ASC. Used by UsageAggregator, MetricsCollector, and UsageQueueConsumerWorker.';

-- ---------------------------------------------------------------------------
-- workflow_executions
-- Query shape:
--   WHERE organization_id = $1
--     AND status IN (''pending'', ''in_progress'', ''waiting_approval'')
--   ORDER BY created_at DESC
-- Services:
--   - packages/backend/src/services/workflow/HumanCheckpointService.ts
--   - packages/backend/src/services/workflows/WorkflowDAGIntegration.ts
--   - packages/backend/src/services/workflows/WorkflowExecutionStore.ts
--   - packages/backend/src/runtime/execution-runtime/WorkflowExecutor.ts
-- Notes:
--   The legacy script wanted an active-workflow partial index but used a
--   non-canonical status set. This version matches the current workflow table
--   contract and keeps organization_id first for tenant isolation.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_workflow_executions_org_active_created
  ON public.workflow_executions (organization_id, created_at DESC)
  WHERE status IN ('pending', 'in_progress', 'waiting_approval');

COMMENT ON INDEX public.idx_workflow_executions_org_active_created IS
  'Active workflow dashboards/pollers: organization-scoped pending, in_progress, and waiting_approval executions ordered by created_at DESC.';

-- ---------------------------------------------------------------------------
-- workflow_execution_logs
-- Query shape:
--   WHERE execution_id = $1
--     AND organization_id = $2
--   ORDER BY created_at ASC
-- Services:
--   - packages/backend/src/services/workflows/WorkflowExecutionStore.ts
--   - packages/backend/src/services/workflow/WorkflowCompensation.ts
-- Notes:
--   Replaces two independent filters with a single tenant-leading lookup path.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_org_execution_created
  ON public.workflow_execution_logs (organization_id, execution_id, created_at ASC);

COMMENT ON INDEX public.idx_workflow_execution_logs_org_execution_created IS
  'WorkflowExecutionStore and WorkflowCompensation log replay path: organization_id + execution_id ordered by created_at.';
