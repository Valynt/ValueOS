-- Rollback: 20260304000500_tenant_execution_state
DROP TABLE IF EXISTS public.tenant_execution_state_audit CASCADE;
DROP TABLE IF EXISTS public.tenant_execution_state CASCADE;
