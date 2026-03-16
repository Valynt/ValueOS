-- Rollback: 20260304040000_tenant_execution_state
-- Drops tenant_execution_state and tenant_execution_state_audit.

BEGIN;

DROP TABLE IF EXISTS public.tenant_execution_state_audit CASCADE;
DROP TABLE IF EXISTS public.tenant_execution_state CASCADE;

COMMIT;
