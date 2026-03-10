-- Rollback: Sprint 14 performance indexes

DROP INDEX IF EXISTS public.idx_approval_requests_tenant_status;
DROP INDEX IF EXISTS public.idx_approval_requests_requester_created;
DROP INDEX IF EXISTS public.idx_workflow_executions_org_status;
DROP INDEX IF EXISTS public.idx_workflow_executions_case_created;
DROP INDEX IF EXISTS public.idx_prompt_executions_tenant_version;
DROP INDEX IF EXISTS public.idx_prompt_executions_session;
DROP INDEX IF EXISTS public.idx_agent_predictions_org_type_created;
DROP INDEX IF EXISTS public.idx_value_cases_org_status;
DROP INDEX IF EXISTS public.idx_active_sessions_tenant_expires;
DROP INDEX IF EXISTS public.idx_user_tenants_user_id;
DROP INDEX IF EXISTS public.idx_agent_memory_org_session_type;
DROP INDEX IF EXISTS public.idx_value_loop_analytics_org_event;
DROP INDEX IF EXISTS public.idx_saga_transitions_case_trigger;
