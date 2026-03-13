-- Rollback: 20260324000000_performance_indexes.sql
-- Drops the performance indexes added for hot-path queries.

SET search_path = public, pg_temp;

DROP INDEX IF EXISTS public.idx_approval_requests_org_status;
DROP INDEX IF EXISTS public.idx_approval_requests_requested_by_created;
DROP INDEX IF EXISTS public.idx_value_cases_org_status;
DROP INDEX IF EXISTS public.idx_user_tenants_user_id;
DROP INDEX IF EXISTS public.idx_agent_memory_org_session_type;
DROP INDEX IF EXISTS public.idx_saga_transitions_case_trigger;
