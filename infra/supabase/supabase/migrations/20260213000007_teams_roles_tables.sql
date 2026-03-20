-- Creates public.teams, public.roles, and public.user_roles used by
-- TenantOrganizationProvisioning.createTeamsAndRoles during tenant setup.

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

CREATE INDEX IF NOT EXISTS idx_teams_tenant_id ON public.teams (tenant_id);

CREATE TABLE IF NOT EXISTS public.roles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  description text,
  permissions text[]      NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    text        NOT NULL,
  tenant_id  text        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_id    uuid        NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_id ON public.user_roles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id   ON public.user_roles (user_id);

-- RLS
ALTER TABLE public.teams     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.teams     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.roles      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON public.user_roles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "members_select" ON public.teams FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_tenants ut
    WHERE ut.tenant_id = teams.tenant_id
      AND ut.user_id = auth.uid()::text
      AND ut.status = 'active'
  ));

CREATE POLICY "members_select" ON public.roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "members_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

GRANT ALL    ON public.teams     TO service_role;
GRANT ALL    ON public.roles      TO service_role;
GRANT ALL    ON public.user_roles TO service_role;
GRANT SELECT ON public.teams     TO authenticated;
GRANT SELECT ON public.roles      TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
