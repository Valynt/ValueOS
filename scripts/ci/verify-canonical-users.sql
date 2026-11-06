-- Negative identity contract checks against the ACTUAL migrated schema.
-- All fixtures are transactional and rolled back. Run as superuser in a
-- disposable Postgres test database with the Supabase Auth test surface.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $schema$
DECLARE
  user_type regtype;
  tenant_type regtype;
BEGIN
  SELECT a.atttypid::regtype INTO user_type
    FROM pg_attribute a WHERE a.attrelid = 'public.users'::regclass
     AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT a.atttypid::regtype INTO tenant_type
    FROM pg_attribute a WHERE a.attrelid = 'public.user_tenants'::regclass
     AND a.attname = 'user_id' AND NOT a.attisdropped;
  IF user_type::text <> 'uuid' OR tenant_type::text <> 'text' THEN
    RAISE EXCEPTION 'Identity type mismatch public.users.id=% user_tenants.user_id=%',
      user_type, tenant_type;
  END IF;
  IF NOT (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    RAISE EXCEPTION 'public.users has RLS disabled';
  END IF;
END $schema$;

INSERT INTO auth.users (id) VALUES
  ('00000000-0000-4000-8000-000000000111'),
  ('00000000-0000-4000-8000-000000000222');
INSERT INTO public.tenants (id, name) VALUES
  ('identity-test-a', 'Identity Test A'),
  ('identity-test-b', 'Identity Test B');
INSERT INTO public.organizations (id, tenant_id, name) VALUES
  ('10000000-0000-4000-8000-000000000111', 'identity-test-a', 'Identity A'),
  ('20000000-0000-4000-8000-000000000222', 'identity-test-b', 'Identity B');
INSERT INTO public.user_tenants (tenant_id, user_id, role, status) VALUES
  ('identity-test-a', '00000000-0000-4000-8000-000000000111', 'member', 'active'),
  ('identity-test-b', '00000000-0000-4000-8000-000000000222', 'member', 'active');
INSERT INTO public.users (id, tenant_id, organization_id, email) VALUES
  ('00000000-0000-4000-8000-000000000111', 'identity-test-a',
   '10000000-0000-4000-8000-000000000111', 'one@example.invalid'),
  ('00000000-0000-4000-8000-000000000222', 'identity-test-b',
   '20000000-0000-4000-8000-000000000222', 'two@example.invalid');

DO $integrity$
BEGIN
  BEGIN
    INSERT INTO public.users (id, tenant_id, organization_id)
      VALUES ('00000000-0000-4000-8000-000000000333', 'identity-test-a',
              '10000000-0000-4000-8000-000000000111');
    RAISE EXCEPTION 'Auth FK accepted an unknown user';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.users
      SET organization_id = '20000000-0000-4000-8000-000000000222'
      WHERE id = '00000000-0000-4000-8000-000000000111';
    RAISE EXCEPTION 'Organization/tenant FK accepted mismatch';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $integrity$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000111';

DO $rls$
DECLARE
  visible_rows integer;
  changed_rows integer;
BEGIN
  SELECT COUNT(*) INTO visible_rows FROM public.users;
  IF visible_rows <> 1 THEN
    RAISE EXCEPTION 'Cross-user read permitted or own profile hidden: % rows', visible_rows;
  END IF;

  IF NOT security.user_has_tenant_access('identity-test-a'::text)
     OR security.user_has_tenant_access('identity-test-b'::text) THEN
    RAISE EXCEPTION 'Tenant membership resolution leaked cross-tenant access';
  END IF;

  UPDATE public.users SET display_name = 'Allowed Edit'
    WHERE id = '00000000-0000-4000-8000-000000000111';
  GET DIAGNOSTICS changed_rows = ROW_COUNT;
  IF changed_rows <> 1 THEN
    RAISE EXCEPTION 'Own benign-profile update rejected: %', changed_rows;
  END IF;

  UPDATE public.users SET display_name = 'Forbidden Edit'
    WHERE id = '00000000-0000-4000-8000-000000000222';
  GET DIAGNOSTICS changed_rows = ROW_COUNT;
  IF changed_rows <> 0 THEN
    RAISE EXCEPTION 'Cross-user profile update succeeded';
  END IF;

  BEGIN
    UPDATE public.users SET tenant_id = 'identity-test-b'
      WHERE id = '00000000-0000-4000-8000-000000000111';
    RAISE EXCEPTION 'Authenticated user changed trusted tenant assignment';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $rls$;
ROLLBACK;
