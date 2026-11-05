-- Safe rollback of canonical identity prerequisites.
-- Never drop pre-existing tables, canonical-owned objects, data, or dependents.
SET lock_timeout = '5s';
SET statement_timeout = '120s';

DO $rollback$
BEGIN
  IF to_regclass('public.user_tenants') IS NOT NULL
     AND obj_description(to_regclass('public.user_tenants'), 'pg_class') = 'valueos-prerequisite:20260213000004' THEN
    IF EXISTS (SELECT 1 FROM public.user_tenants LIMIT 1) THEN
      RAISE EXCEPTION 'Cannot roll back user_tenants prerequisite: data exists';
    END IF;
    DROP TABLE public.user_tenants RESTRICT;
  END IF;

  IF to_regclass('public.tenants') IS NOT NULL
     AND obj_description(to_regclass('public.tenants'), 'pg_class') = 'valueos-prerequisite:20260213000004' THEN
    IF EXISTS (SELECT 1 FROM public.tenants LIMIT 1) THEN
      RAISE EXCEPTION 'Cannot roll back tenants prerequisite: data exists';
    END IF;
    DROP TABLE public.tenants RESTRICT;
  END IF;
END $rollback$;
