-- ============================================================================
-- Add disabled_by_sync to memberships + tighten sync trigger
--
-- The sync_user_tenants_to_memberships trigger disables memberships rows when
-- a user_tenants row goes inactive or is deleted. Without a way to distinguish
-- trigger-disabled rows from admin-disabled rows, the reactivation path would
-- silently re-enable memberships that were intentionally suspended through a
-- separate path (e.g. compliance hold, manual admin action).
--
-- Fix: add disabled_by_sync boolean to memberships. The trigger sets it true
-- when it disables a row and only reactivates rows where it is true, leaving
-- admin-disabled rows untouched.
-- ============================================================================

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. Add disabled_by_sync column to memberships
-- ============================================================================

ALTER TABLE public.memberships
    ADD COLUMN IF NOT EXISTS disabled_by_sync boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.memberships.disabled_by_sync IS
    'True when this row was disabled by the sync_user_tenants_to_memberships '
    'trigger. Used to distinguish trigger-managed disablement from admin-managed '
    'disablement so reactivation does not override intentional suspensions.';

-- ============================================================================
-- 2. Redefine trigger function to track disabled_by_sync
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_user_tenants_to_memberships()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Hard removal: disable the memberships row and mark it as sync-disabled.
    UPDATE public.memberships
    SET    status          = 'disabled',
           disabled_by_sync = true,
           updated_at      = now()
    WHERE  tenant_id       = OLD.tenant_id
      AND  user_id::text   = OLD.user_id;

    RETURN OLD;
  END IF;

  -- UPDATE: propagate inactive status to memberships.
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'inactive' THEN
    UPDATE public.memberships
    SET    status          = 'disabled',
           disabled_by_sync = true,
           updated_at      = now()
    WHERE  tenant_id       = NEW.tenant_id
      AND  user_id::text   = NEW.user_id;
  END IF;

  -- Reactivation: only re-enable rows that this trigger previously disabled.
  -- Rows disabled by admin action (disabled_by_sync = false) are left untouched.
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'active' THEN
    UPDATE public.memberships
    SET    status          = 'active',
           disabled_by_sync = false,
           updated_at      = now()
    WHERE  tenant_id       = NEW.tenant_id
      AND  user_id::text   = NEW.user_id
      AND  status          = 'disabled'
      AND  disabled_by_sync = true;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_user_tenants_to_memberships() IS
  'Keeps memberships.status in sync with user_tenants.status so that RBAC '
  'graph queries cannot be used by suspended or removed users. '
  'Uses disabled_by_sync to avoid re-enabling admin-disabled memberships.';
