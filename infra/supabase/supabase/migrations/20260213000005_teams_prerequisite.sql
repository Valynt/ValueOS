-- The 20260213000006 settings policy reads public.teams before
-- 20260213000007 installs its canonical table, grants and RLS policies.
SET lock_timeout = '5s';
SET statement_timeout = '120s';

DO $prereq$
BEGIN
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
    COMMENT ON TABLE public.teams IS 'valueos-prerequisite:20260213000005';
  END IF;
END $prereq$;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
