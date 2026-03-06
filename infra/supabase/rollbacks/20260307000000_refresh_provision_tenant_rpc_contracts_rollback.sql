-- Rollback: 20260307000000_refresh_provision_tenant_rpc_contracts
-- Re-applies the previous provision_tenant function signature from
-- 20260306000000_harden_provision_tenant_function.sql.
-- Forward-fix preferred over rollback for function contract changes.
DROP FUNCTION IF EXISTS public.provision_tenant(text, uuid);
