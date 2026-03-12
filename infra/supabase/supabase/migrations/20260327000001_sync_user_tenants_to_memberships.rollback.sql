-- Rollback: remove the trigger and function added by
-- 20260327000001_sync_user_tenants_to_memberships.sql

DROP TRIGGER IF EXISTS trg_sync_user_tenants_to_memberships ON public.user_tenants;
DROP FUNCTION IF EXISTS public.sync_user_tenants_to_memberships();
