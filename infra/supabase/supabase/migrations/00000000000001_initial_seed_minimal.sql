-- Initial release seed migration.
-- Seeds a demo user, tenant, and membership for local development.
-- Credentials: dev@valueos.local / password123
-- Idempotent: all inserts use ON CONFLICT DO NOTHING.

DO $$
DECLARE
  demo_user_id  uuid := '00000000-0000-0000-0000-000000000001';
  demo_tenant   text := 'demo-tenant-001';
  demo_email    text := 'dev@valueos.local';
  -- Pre-computed bcrypt hash of 'password123' (cost 10).
  -- Does not require pgcrypto extension.
  pw_hash       text := '$2b$10$yI.hd93r3MgRiD8L1E7fOu52hLL2rBaIUO7Ahx/ruKOqNvwV65Gi6';
BEGIN

  -- 1. auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at, is_sso_user
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    demo_user_id,
    'authenticated',
    'authenticated',
    demo_email,
    pw_hash,
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', 'Demo Developer'),
    false,
    now(),
    now(),
    false
  ) ON CONFLICT (id) DO NOTHING;

  -- 2. auth.identities (required for GoTrue email login)
  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    demo_user_id::text,
    demo_user_id,
    jsonb_build_object('sub', demo_user_id::text, 'email', demo_email, 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  ) ON CONFLICT (provider_id, provider) DO NOTHING;

  -- 3. Demo tenant
  INSERT INTO public.tenants (id, name, status, slug)
  VALUES (demo_tenant, 'Demo Organization', 'active', 'demo')
  ON CONFLICT (id) DO NOTHING;

  -- 4. user_tenants (owner)
  INSERT INTO public.user_tenants (tenant_id, user_id, role, status)
  VALUES (demo_tenant, demo_user_id::text, 'owner', 'active')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  -- 5. memberships (owner)
  INSERT INTO public.memberships (tenant_id, user_id, status, is_owner)
  VALUES (demo_tenant, demo_user_id, 'active', true)
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  RAISE NOTICE 'Demo user seeded: % / password123', demo_email;
END $$;
