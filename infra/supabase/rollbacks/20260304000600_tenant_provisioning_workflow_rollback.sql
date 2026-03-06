-- Rollback: 20260304000600_tenant_provisioning_workflow
DROP FUNCTION IF EXISTS public.tenant_provisioning_workflow(text, uuid, text);
DROP TABLE IF EXISTS public.tenant_provisioning_requests CASCADE;
