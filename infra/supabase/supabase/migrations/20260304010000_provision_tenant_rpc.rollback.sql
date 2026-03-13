-- Rollback: 20260304010000_provision_tenant_rpc.sql
-- Drops the provision_tenant RPC function.

SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.provision_tenant(text, uuid) CASCADE;
