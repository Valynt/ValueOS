-- Forward-only prerequisite for 20260213000006_settings_table.sql.
-- That migration's team_scope_select policy reads public.teams before the
-- canonical 20260213000007_teams_roles_tables.sql defines it.
-- Match the canonical table declaration, enable RLS immediately, and leave
-- policies/grants to the canonical 00007 migration. No data seeding.
CREATE TABLE IF NOT EXISTS public.teams (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     text        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name          varchar(255) NOT NULL,
  description   text,
  team_settings jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
