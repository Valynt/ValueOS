-- Rollback: 20260307000000_refresh_provision_tenant_rpc_contracts.sql
-- Drops the provision_tenant(text, uuid) function defined by this migration.
-- The prior version (from 20260304010000_provision_tenant_rpc.sql) must be
-- re-applied manually if the function is still required.

SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.provision_tenant(text, uuid) CASCADE;
