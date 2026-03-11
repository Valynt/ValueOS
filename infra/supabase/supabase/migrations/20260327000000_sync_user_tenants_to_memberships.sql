-- ============================================================================
-- Sync user_tenants → memberships
--
-- user_tenants is the RLS authority (security.user_has_tenant_access reads it).
-- memberships is the RBAC graph root (membership_roles → role_permissions).
-- When a row in user_tenants is set inactive or deleted, the corresponding
-- memberships row must be disabled so that permission resolution via the
-- membership_roles graph cannot be used by a suspended/removed user.
--
-- The trigger fires AFTER UPDATE or DELETE on user_tenants and propagates
-- the status change to memberships. It does not create memberships rows —
-- that remains the responsibility of the provisioning path.
-- ============================================================================

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. Trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_user_tenants_to_memberships()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Hard removal: disable the memberships row so RBAC graph queries return nothing.
    UPDATE public.memberships
    SET    status     = 'disabled',
           updated_at = now()
    WHERE  tenant_id = OLD.tenant_id
      AND  user_id::text = OLD.user_id;

    RETURN OLD;
  END IF;

  -- UPDATE: propagate inactive status to memberships.
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'inactive' THEN
    UPDATE public.memberships
    SET    status     = 'disabled',
           updated_at = now()
    WHERE  tenant_id = NEW.tenant_id
      AND  user_id::text = NEW.user_id;
  END IF;

  -- Reactivation: if a previously inactive row is set back to active,
  -- re-enable the memberships row so the user regains RBAC graph access.
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'active' THEN
    UPDATE public.memberships
    SET    status     = 'active',
           updated_at = now()
    WHERE  tenant_id = NEW.tenant_id
      AND  user_id::text = NEW.user_id
      AND  status = 'disabled';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_user_tenants_to_memberships() IS
  'Keeps memberships.status in sync with user_tenants.status so that RBAC '
  'graph queries cannot be used by suspended or removed users.';

-- ============================================================================
-- 2. Attach trigger to user_tenants
-- ============================================================================

DROP TRIGGER IF EXISTS trg_sync_user_tenants_to_memberships ON public.user_tenants;

CREATE TRIGGER trg_sync_user_tenants_to_memberships
  AFTER UPDATE OF status OR DELETE
  ON public.user_tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_tenants_to_memberships();

-- ============================================================================
-- 3. Rollback companion (inline comment — see .rollback.sql)
-- ============================================================================
-- DROP TRIGGER IF EXISTS trg_sync_user_tenants_to_memberships ON public.user_tenants;
-- DROP FUNCTION IF EXISTS public.sync_user_tenants_to_memberships();
