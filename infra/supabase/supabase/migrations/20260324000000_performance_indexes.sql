-- Sprint 14: Performance indexes
-- Adds composite indexes for the hot query patterns identified in Sprint 14
-- profiling. All indexes are CONCURRENTLY-safe (IF NOT EXISTS).

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- approval_requests
-- Hot queries: (organization_id, status) for pending approvals list
-- Canonical columns: organization_id, requested_by (not tenant_id/requester_id)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_approval_requests_org_status
  ON public.approval_requests (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by_created
  ON public.approval_requests (requested_by, created_at DESC);

-- ---------------------------------------------------------------------------
-- workflow_executions
-- NOTE: created_at and case_id columns are added in
-- 20260327020000_fix_performance_index_violations.sql. Indexes that depend
-- on those columns are created there, after the columns exist.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- prompt_executions
-- Hot queries: (tenant_id, prompt_version_id)
-- NOTE: session_id column is added in 20260327020000. The session index is
-- created there.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_prompt_executions_tenant_version
  ON public.prompt_executions (tenant_id, prompt_version_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- agent_predictions
-- NOTE: organization_id column is added in 20260327020000. The org index is
-- created there.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- value_cases
-- Hot queries: (organization_id, status), (organization_id, created_at)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_value_cases_org_status
  ON public.value_cases (organization_id, status, created_at DESC);

-- active_sessions: table does not exist in the migration chain; index removed.
-- See 20260327020000 for the DROP INDEX cleanup.

-- ---------------------------------------------------------------------------
-- user_tenants
-- Hot queries: (user_id) for tenant membership lookups
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id
  ON public.user_tenants (user_id);

-- ---------------------------------------------------------------------------
-- agent_memory
-- Composite index for tenant-scoped agent memory retrieval
-- (organization_id, session_id, memory_type) — the primary access pattern
-- in SupabaseMemoryBackend.retrieve()
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_agent_memory_org_session_type
  ON public.agent_memory (organization_id, session_id, memory_type, created_at DESC);

-- value_loop_analytics: table name was wrong; real table is value_loop_events.
-- The correct index already exists in 20260320000000_value_loop_analytics.sql.
-- See 20260327020000 for the DROP INDEX cleanup of the phantom index.

-- ---------------------------------------------------------------------------
-- saga_transitions (Sprint 13)
-- Already has (value_case_id, organization_id, created_at DESC) — add
-- a covering index for the trigger-based queries used in compensation lookups
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_saga_transitions_case_trigger
  ON public.saga_transitions (value_case_id, trigger, created_at DESC);
