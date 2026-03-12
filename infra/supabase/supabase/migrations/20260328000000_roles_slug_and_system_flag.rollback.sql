-- Rollback: 20260328000000_roles_slug_and_system_flag

SET search_path = public, pg_temp;

DROP INDEX IF EXISTS public.idx_roles_system_slug;
DROP INDEX IF EXISTS public.idx_roles_tenant_slug;
DROP INDEX IF EXISTS public.idx_roles_tenant_id;

ALTER TABLE public.roles
  DROP COLUMN IF EXISTS is_system_role,
  DROP COLUMN IF EXISTS slug,
  DROP COLUMN IF EXISTS tenant_id;
