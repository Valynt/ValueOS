-- Roll back only objects created by the canonical users migration.
-- A deployed identity table with data or dependent FKs cannot be removed.
SET lock_timeout = '5s';
SET statement_timeout = '120s';

BEGIN;
DO $rollback$
BEGIN
  IF to_regclass('public.users') IS NOT NULL
     AND obj_description(to_regclass('public.users'), 'pg_class')
       LIKE 'valueos-canonical-users:20260317010000%' THEN
    -- Prevent concurrent inserts after the emptiness check but before DROP.
    -- Held to transaction commit; lock_timeout fails closed.
    LOCK TABLE public.users IN ACCESS EXCLUSIVE MODE;
    IF EXISTS (SELECT 1 FROM public.users LIMIT 1) THEN
      RAISE EXCEPTION 'Refusing identity rollback: users data exists';
    END IF;
    DROP TABLE public.users RESTRICT;
  END IF;
  IF to_regclass('public.organizations_id_tenant_id_unique') IS NOT NULL
     AND obj_description(to_regclass('public.organizations_id_tenant_id_unique'), 'pg_class')
       = 'valueos-canonical-users:20260317010000' THEN
    DROP INDEX public.organizations_id_tenant_id_unique RESTRICT;
  END IF;
END $rollback$;
COMMIT;
