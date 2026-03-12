BEGIN;

CREATE TABLE IF NOT EXISTS public.projects (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  normalized_name text GENERATED ALWAYS AS (lower(trim(name))) STORED,
  description text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'paused', 'completed')),
  tags text[] NOT NULL DEFAULT '{}'::text[],
  owner_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_org_normalized_name_unique UNIQUE (organization_id, normalized_name)
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_select ON public.projects;
DROP POLICY IF EXISTS projects_insert ON public.projects;
DROP POLICY IF EXISTS projects_update ON public.projects;
DROP POLICY IF EXISTS projects_delete ON public.projects;

CREATE POLICY projects_select ON public.projects
  FOR SELECT USING (security.user_has_tenant_access(organization_id));

CREATE POLICY projects_insert ON public.projects
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id));

CREATE POLICY projects_update ON public.projects
  FOR UPDATE
  USING (security.user_has_tenant_access(organization_id))
  WITH CHECK (security.user_has_tenant_access(organization_id));

CREATE POLICY projects_delete ON public.projects
  FOR DELETE USING (security.user_has_tenant_access(organization_id));

CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects (organization_id, id);
CREATE INDEX IF NOT EXISTS idx_projects_org_lower_name ON public.projects (organization_id, lower(name));

COMMIT;
