-- Prevent authenticated users from adding themselves to arbitrary tenants
-- or editing their membership role/status before invoking privileged DSR RPCs.
-- Enrollment and administrative role changes must use an authorized service
-- provisioning path. No user_tenants rows are deleted or reassigned.
-- RLS classification: own_row for SELECT; service_only for writes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
LOCK TABLE public.user_tenants IN SHARE ROW EXCLUSIVE MODE;

-- ACL protects against ordinary direct authenticated API calls. Restrictive
-- RLS below ALSO blocks access if a later migration restores a table grant.
REVOKE INSERT, UPDATE, DELETE ON public.user_tenants
  FROM authenticated, anon, PUBLIC;
REVOKE UPDATE (tenant_id, user_id, role, status, created_at, updated_at)
  ON public.user_tenants FROM authenticated, anon, PUBLIC;
GRANT SELECT ON public.user_tenants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tenants TO service_role;
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

DO $guards$
DECLARE
  operation text;
  policy text;
  observed boolean;
  mode "char";
BEGIN
  FOREACH operation IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
    policy := 'user_tenants_authenticated_' || lower(operation) || '_deny';
    mode := CASE operation WHEN 'INSERT' THEN 'a'
      WHEN 'UPDATE' THEN 'w' ELSE 'd' END;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policy
      WHERE polrelid = 'public.user_tenants'::regclass AND polname = policy
    ) THEN
      IF operation = 'INSERT' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.user_tenants AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false)',
          policy);
      ELSIF operation = 'UPDATE' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.user_tenants AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false)',
          policy);
      ELSE
        EXECUTE format(
          'CREATE POLICY %I ON public.user_tenants AS RESTRICTIVE FOR DELETE TO authenticated USING (false)',
          policy);
      END IF;
    ELSE
      SELECT NOT polpermissive AND polcmd = mode INTO observed
      FROM pg_policy
      WHERE polrelid = 'public.user_tenants'::regclass AND polname = policy;
      IF NOT observed THEN
        RAISE EXCEPTION 'Existing user_tenants write guard is incompatible: %',
          policy USING ERRCODE = '23514';
      END IF;
    END IF;
  END LOOP;
END $guards$;
COMMIT;
