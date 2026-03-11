-- Sprint 14: Performance indexes
-- Adds composite indexes for the hot query patterns identified in Sprint 14
-- profiling.
--
-- IMPORTANT: indexes for tables that do not yet have active migrations have
-- been moved to _deferred/20260324000000_performance_indexes_deferred.sql.
-- They must not be applied until the owning table migrations are promoted
-- from _deferred/ to the active chain.
--
-- Tables covered here (all have active migrations or exist via baseline):
--   approval_requests, value_cases, agent_memory, saga_transitions,
--   user_tenants, value_loop_events
--
-- Tables deferred (no active migration yet):
--   workflow_executions, prompt_executions, agent_predictions,
--   active_sessions, value_loop_analytics

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- approval_requests
-- Hot queries: (organization_id, status) for pending approvals list
-- DDL uses organization_id (not tenant_id). Index corrected to match.
-- Canonical columns: organization_id, requested_by (not tenant_id/requester_id)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_approval_requests_org_status
  ON public.approval_requests (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by_created
  ON public.approval_requests (requested_by, created_at DESC);

-- ---------------------------------------------------------------------------
-- value_cases
-- Hot queries: (organization_id, status), (organization_id, created_at)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_value_cases_org_status
  ON public.value_cases (organization_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- user_tenants
-- Hot queries: (user_id) for tenant membership lookups.
-- Table exists via the archived monolith baseline.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id
  ON public.user_tenants (user_id);

-- ---------------------------------------------------------------------------
-- agent_memory
-- Composite index for tenant-scoped agent memory retrieval.
-- (organization_id, session_id, memory_type) — primary access pattern
-- in SupabaseMemoryBackend.retrieve()
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_agent_memory_org_session_type
  ON public.agent_memory (organization_id, session_id, memory_type, created_at DESC);

-- value_loop_events: real table is value_loop_events.
-- The correct index already exists in 20260320000000_value_loop_analytics.sql.
-- See 20260327020000 for cleanup of the phantom index.

-- ---------------------------------------------------------------------------
-- saga_transitions (Sprint 13)
-- Covering index for trigger-based compensation lookups.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_saga_transitions_case_trigger
  ON public.saga_transitions (value_case_id, trigger, created_at DESC);
