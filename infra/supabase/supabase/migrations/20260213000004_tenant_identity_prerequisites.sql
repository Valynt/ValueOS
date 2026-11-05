-- Canonical identity prerequisites for the 20260213000005 organizations migration.
-- Only create tables if missing; later 20260213000010 installs access policies.
-- RLS is enabled immediately and no unauthenticated access is granted.
SET lock_timeout = '5s';
SET statement_timeout = '120s';

DO $prereq$
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    CREATE TABLE public.tenants (
      id text NOT NULL,
      name text NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      settings jsonb DEFAULT '{}'::jsonb,
      status text DEFAULT 'active',
      CONSTRAINT tenants_pkey PRIMARY KEY (id),
      CONSTRAINT tenants_status_check CHECK (status = ANY (ARRAY['active','suspended','deleted']))
    );
    COMMENT ON TABLE public.tenants IS 'valueos-prerequisite:20260213000004';
  END IF;

  IF to_regclass('public.user_tenants') IS NULL THEN
    CREATE TABLE public.user_tenants (
      tenant_id text NOT NULL,
      user_id text NOT NULL,
      role text DEFAULT 'member',
      status text DEFAULT 'active',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      CONSTRAINT user_tenants_pkey PRIMARY KEY (tenant_id, user_id),
      CONSTRAINT user_tenants_role_check CHECK (role = ANY (ARRAY['owner','admin','member','viewer'])),
      CONSTRAINT user_tenants_status_check CHECK (status = ANY (ARRAY['active','inactive']))
    );
    COMMENT ON TABLE public.user_tenants IS 'valueos-prerequisite:20260213000004';
  END IF;
END $prereq$;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;
