-- Harden public.provision_tenant with explicit execution context and least privilege.
-- This function intentionally bypasses normal tenant RLS during bootstrap, so access
-- must stay restricted to backend-controlled callers only.

SET search_path = public, pg_temp;

DO $$
DECLARE
  fn RECORD;
  bypass_comment CONSTANT text :=
    'SECURITY NOTE: This function intentionally bypasses normal RLS to perform tenant bootstrap writes atomically. Allowed caller path: backend provisioning flow using the service_role credential only. Do not grant to end-user roles.';
  provision_fn_found boolean := false;
BEGIN
  FOR fn IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc AS p
    INNER JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'provision_tenant'
  LOOP
    provision_fn_found := true;

    -- Use a controlled, non user-writable owner role.
    EXECUTE format('ALTER FUNCTION public.provision_tenant(%s) OWNER TO postgres', fn.args);

    -- Lock execution lookup to trusted schemas only.
    EXECUTE format(
      'ALTER FUNCTION public.provision_tenant(%s) SET search_path = public, pg_temp',
      fn.args
    );

    -- Remove implicit execution from every role.
    EXECUTE format('REVOKE ALL ON FUNCTION public.provision_tenant(%s) FROM PUBLIC', fn.args);

    -- Allow execution only from backend provisioning credentials.
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.provision_tenant(%s) TO service_role', fn.args);

    EXECUTE format(
      'COMMENT ON FUNCTION public.provision_tenant(%s) IS %L',
      fn.args,
      bypass_comment
    );
  END LOOP;

  IF NOT provision_fn_found THEN
    RAISE EXCEPTION 'public.provision_tenant(...) was not found. Apply this hardening in the same migration where the function is created.';
  END IF;
END $$;
