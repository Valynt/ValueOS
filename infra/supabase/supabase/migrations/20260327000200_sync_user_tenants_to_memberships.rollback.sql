-- Rollback: 20260327000000_sync_user_tenants_to_memberships
DROP TRIGGER IF EXISTS trg_sync_user_tenants_to_memberships ON public.user_tenants;
DROP FUNCTION IF EXISTS public.sync_user_tenants_to_memberships();
