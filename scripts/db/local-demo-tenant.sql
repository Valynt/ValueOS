-- LOCAL DEVELOPMENT ONLY; intentionally excluded from production migrations.
-- Requires a real Supabase Auth user created separately with a private password.
-- The caller verifies localhost and explicit opt-in before executing this file.
BEGIN;

SET LOCAL app.local_demo_user_id = :'demo_auth_user_id';

DO $$
DECLARE
  demo_user_id uuid := current_setting('app.local_demo_user_id')::uuid;
  demo_tenant_id constant text := 'local-demo-tenant';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = demo_user_id) THEN
    RAISE EXCEPTION 'Demo Auth user does not exist. Create a LOCAL user through Supabase Auth first.';
  END IF;

  INSERT INTO public.tenants (id, name, status)
  VALUES (demo_tenant_id, 'Local Development Organization', 'active')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_tenants (tenant_id, user_id, role, status)
  VALUES (demo_tenant_id, demo_user_id::text, 'owner', 'active')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  INSERT INTO public.memberships (tenant_id, user_id, status, is_owner)
  VALUES (demo_tenant_id, demo_user_id, 'active', true)
  ON CONFLICT (tenant_id, user_id) DO NOTHING;
END $$;

COMMIT;
