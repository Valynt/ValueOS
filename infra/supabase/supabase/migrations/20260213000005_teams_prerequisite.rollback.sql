-- Safe rollback of the teams prerequisite. Do not delete tenant data.
SET lock_timeout = '5s';
SET statement_timeout = '120s';

DO $rollback$
BEGIN
  IF to_regclass('public.teams') IS NOT NULL
     AND obj_description(to_regclass('public.teams'), 'pg_class') = 'valueos-prerequisite:20260213000005' THEN
    IF EXISTS (SELECT 1 FROM public.teams LIMIT 1) THEN
      RAISE EXCEPTION 'Cannot roll back teams prerequisite: data exists';
    END IF;
    DROP TABLE public.teams RESTRICT;
  END IF;
END $rollback$;
