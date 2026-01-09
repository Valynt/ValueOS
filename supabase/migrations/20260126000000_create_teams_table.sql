-- Create teams table
-- Depends on tenants table (tenant_id is TEXT)

CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  team_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT teams_tenant_id_name_key UNIQUE (tenant_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teams_tenant_id ON public.teams(tenant_id);

-- Trigger for updated_at
-- Assuming standard update_updated_at_column function exists as seen in other tables
DROP TRIGGER IF EXISTS update_teams_updated_at ON public.teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Service role has full access
CREATE POLICY teams_service_role ON public.teams
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can view teams in their tenant
-- Checks public.user_roles to verify membership in the tenant
CREATE POLICY teams_select ON public.teams
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (auth.uid())::text
        AND ur.tenant_id = teams.tenant_id
    )
  );

-- Only tenant owners/admins can insert/update/delete teams
-- Checks public.user_roles joined with public.roles to verify role assignment
CREATE POLICY teams_modify ON public.teams
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = (auth.uid())::text
        AND ur.tenant_id = teams.tenant_id
        AND r.name IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = (auth.uid())::text
        AND ur.tenant_id = teams.tenant_id
        AND r.name IN ('owner', 'admin')
    )
  );
