-- Security-preserving rollback: freeze model writes, retaining rows, FKs and RLS.
-- Do not restore ambiguous ownership or drop columns used by later migrations.
-- Reapplying the paired forward migration validates data and restores CRUD.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
REVOKE INSERT, UPDATE, DELETE ON public.assumptions, public.scenarios FROM authenticated, service_role;
COMMIT;
