-- Pre-canonical tenant identity prerequisites.
-- public.organizations is created by 20260213000005 and requires public.tenants
-- and public.user_tenants before the full canonical migration at 20260213000010.
-- Keep column types/constraints aligned with the later canonical definitions.
-- No default demo user, service credentials, or seed data belongs in migrations.
--
-- Security: both tables are RLS-enabled immediately. Until the canonical
-- migration installs scoped policies, authenticated access is denied.
CREATE TABLE IF NOT EXISTS public.tenants (
  id         text        NOT NULL,
  name       text        NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  settings   jsonb       DEFAULT '{}'::jsonb,
  status     text        DEFAULT 'active',
  CONSTRAINT tenants_pkey PRIMARY KEY (id),
  CONSTRAINT tenants_status_check
    CHECK (status = ANY (ARRAY['active','suspended','deleted']))
);

CREATE TABLE IF NOT EXISTS public.user_tenants (
  tenant_id  text        NOT NULL,
  user_id    text        NOT NULL,
  role       text        DEFAULT 'member',
  status     text        DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_tenants_pkey PRIMARY KEY (tenant_id, user_id),
  CONSTRAINT user_tenants_role_check
    CHECK (role = ANY (ARRAY['owner','admin','member','viewer'])),
  CONSTRAINT user_tenants_status_check
    CHECK (status = ANY (ARRAY['active','inactive']))
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;
