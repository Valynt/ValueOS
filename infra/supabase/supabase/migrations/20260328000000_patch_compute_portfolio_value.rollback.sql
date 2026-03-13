-- Rollback: 20260328000000_patch_compute_portfolio_value.sql
-- Drops the patched compute_portfolio_value function.
--
-- The prior version of this function (from 20260303010000) had a cross-tenant
-- data exposure bug: any authenticated user could read any tenant's portfolio
-- by passing an arbitrary p_tenant_id. It is NOT restored here.
--
-- If the patched version must be replaced, create a new forward migration with
-- a corrected implementation rather than restoring the vulnerable one.

SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.compute_portfolio_value(TEXT) CASCADE;
