-- Security-preserving rollback for late canonical identity policy reconciliation.
-- Do NOT reinstate permissive table-wide UPDATE or unguarded DSR.
-- Rollback deliberately revokes interactive profile edits and direct
-- authenticated erasure until the forward migration is reapplied.
SET lock_timeout = '5s';
SET statement_timeout = '120s';

BEGIN;
DO $rollback$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    REVOKE UPDATE ON public.users FROM authenticated;
    REVOKE UPDATE (name, display_name, avatar_url)
      ON public.users FROM authenticated;
    DROP POLICY IF EXISTS users_own_row_update ON public.users;
  END IF;
  IF to_regprocedure('public.erase_user_pii(text,uuid,timestamptz,text,text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.erase_user_pii(text, uuid, timestamptz, text, text)
      FROM authenticated;
  END IF;
END $rollback$;
COMMIT;
