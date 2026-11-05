-- Safe rollback of the security-audit prerequisite.
-- Reject destructive rollback of audit evidence or dependent objects.
SET lock_timeout = '5s';
SET statement_timeout = '120s';

DO $rollback$
BEGIN
  IF to_regclass('public.security_audit_log') IS NOT NULL
     AND obj_description(to_regclass('public.security_audit_log'), 'pg_class') = 'valueos-prerequisite:20260213000007' THEN
    IF EXISTS (SELECT 1 FROM public.security_audit_log LIMIT 1) THEN
      RAISE EXCEPTION 'Cannot roll back security audit prerequisite: audit evidence exists';
    END IF;
    DROP TABLE public.security_audit_log RESTRICT;
  END IF;
END $rollback$;
