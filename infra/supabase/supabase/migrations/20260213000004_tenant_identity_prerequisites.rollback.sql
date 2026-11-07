-- Reverses ONLY tables created by 20260213000004, in dependency order.
-- Never cascade away production data, audit history, or downstream schemas.
SET lock_timeout = '5s';
SET statement_timeout = '120s';

BEGIN;
DO $rollback$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'security_audit_log', 'teams', 'user_tenants', 'tenants'
  ] LOOP
    IF to_regclass('public.' || target) IS NULL
       OR obj_description(to_regclass('public.' || target), 'pg_class')
          IS DISTINCT FROM 'valueos-prerequisite:20260213000004' THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = target
        AND c.relkind NOT IN ('r','p')
    ) THEN
      RAISE EXCEPTION 'Unexpected identity prerequisite object type: %', target;
    END IF;

    -- Lock BEFORE checking emptiness: ACCESS SHARE is not sufficient since
    -- a concurrent INSERT could commit between the check and DROP.
    -- The ACCESS EXCLUSIVE lock is held through COMMIT, or the rollback
    -- fails closed on lock_timeout without deleting any data.
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', target);

    -- Dynamic SQL is limited to four static, validated identifiers above.
    IF target = 'security_audit_log' THEN
      IF EXISTS (SELECT 1 FROM public.security_audit_log LIMIT 1) THEN
        RAISE EXCEPTION 'Cannot roll back populated security_audit_log';
      END IF;
      DROP TABLE public.security_audit_log RESTRICT;
    ELSIF target = 'teams' THEN
      IF EXISTS (SELECT 1 FROM public.teams LIMIT 1) THEN
        RAISE EXCEPTION 'Cannot roll back populated teams';
      END IF;
      DROP TABLE public.teams RESTRICT;
    ELSIF target = 'user_tenants' THEN
      IF EXISTS (SELECT 1 FROM public.user_tenants LIMIT 1) THEN
        RAISE EXCEPTION 'Cannot roll back populated user_tenants';
      END IF;
      DROP TABLE public.user_tenants RESTRICT;
    ELSIF target = 'tenants' THEN
      IF EXISTS (SELECT 1 FROM public.tenants LIMIT 1) THEN
        RAISE EXCEPTION 'Cannot roll back populated tenants';
      END IF;
      DROP TABLE public.tenants RESTRICT;
    END IF;
  END LOOP;
END $rollback$;
COMMIT;
