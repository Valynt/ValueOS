-- Rollback: 20260304000000_tenant_provisioning_workflow.sql
-- Drops the tenant_provisioning_requests table.

SET search_path = public, pg_temp;

DROP TABLE IF EXISTS public.tenant_provisioning_requests CASCADE;
