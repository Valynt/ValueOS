-- Rollback: 20260331000000_memberships_disabled_by_sync
--
-- Restores the trigger to its pre-disabled_by_sync behaviour and drops the column.

SET search_path = public, pg_temp;

-- Restore trigger function without disabled_by_sync tracking
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

-- Drop the column added by this migration
ALTER TABLE public.memberships
    DROP COLUMN IF EXISTS disabled_by_sync;
