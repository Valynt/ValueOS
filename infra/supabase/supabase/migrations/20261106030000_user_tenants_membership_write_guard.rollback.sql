-- No automatic rollback of this critical authorization boundary.
-- Reversing role-enrollment protection could allow an ordinary member to
-- become a tenant admin and invoke SECURITY DEFINER erasure functions.
-- A privileged operator must approve any replacement write contract.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.user_tenants IN SHARE ROW EXCLUSIVE MODE;
REVOKE INSERT, UPDATE, DELETE ON public.user_tenants FROM authenticated, anon, PUBLIC;
COMMIT;
