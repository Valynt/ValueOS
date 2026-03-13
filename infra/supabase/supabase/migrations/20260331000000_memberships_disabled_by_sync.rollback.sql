-- Rollback: 20260331000000_memberships_disabled_by_sync.sql
-- Removes the disabled_by_sync column from memberships and restores the
-- sync_user_tenants_to_memberships trigger to its prior version (which did
-- not track whether disablement was trigger-managed vs admin-managed).

SET search_path = public, pg_temp;

-- 1. Restore the prior trigger function (without disabled_by_sync awareness)
CREATE OR REPLACE FUNCTION public.sync_user_tenants_to_memberships()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.memberships
    SET    status     = 'disabled',
           updated_at = now()
    WHERE  tenant_id = OLD.tenant_id
      AND  user_id::text = OLD.user_id;
    RETURN OLD;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'inactive' THEN
    UPDATE public.memberships
    SET    status     = 'disabled',
           updated_at = now()
    WHERE  tenant_id = NEW.tenant_id
      AND  user_id::text = NEW.user_id;
  END IF;

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

-- 2. Re-attach trigger (DROP + CREATE to replace the updated version)
DROP TRIGGER IF EXISTS trg_sync_user_tenants_to_memberships ON public.user_tenants;

CREATE TRIGGER trg_sync_user_tenants_to_memberships
  AFTER UPDATE OF status OR DELETE
  ON public.user_tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_tenants_to_memberships();

-- 3. Remove the disabled_by_sync column
ALTER TABLE public.memberships DROP COLUMN IF EXISTS disabled_by_sync;
