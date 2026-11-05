-- Single uniquely versioned prerequisite for legacy identity dependencies.
-- 20260213000005 organizations needs tenants/user_tenants; 00006 settings
-- needs teams; 00008 audit columns needs security_audit_log.
-- 00007 and 00010 subsequently install canonical constraints and RLS policies.
-- Never introduce duplicate Supabase CLI migration version numbers.
SET lock_timeout = '5s';
SET statement_timeout = '120s';

BEGIN;
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
  ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

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
  ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

  IF to_regclass('public.teams') IS NULL THEN
    CREATE TABLE public.teams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      name varchar(255) NOT NULL,
      description text,
      team_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, name)
    );
    COMMENT ON TABLE public.teams IS 'valueos-prerequisite:20260213000004';
  END IF;
  ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

  IF to_regclass('public.security_audit_log') IS NULL THEN
    CREATE TABLE public.security_audit_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid,
      event_type text NOT NULL,
      actor text,
      user_id uuid,
      action text,
      table_name text,
      attempted_action text,
      details jsonb,
      metadata jsonb,
      blocked_at timestamptz DEFAULT now(),
      created_at timestamptz DEFAULT now()
    );
    COMMENT ON TABLE public.security_audit_log IS 'valueos-prerequisite:20260213000004';
  END IF;
  ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
END $prereq$;
COMMIT;
