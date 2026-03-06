-- Rollback: 20260304000300_provision_tenant_rpc
-- Drops the provision_tenant function. Tenant rows already created are NOT removed.
DROP FUNCTION IF EXISTS public.provision_tenant(text, uuid);
