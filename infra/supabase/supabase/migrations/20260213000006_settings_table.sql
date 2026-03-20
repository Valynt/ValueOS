-- Creates public.settings, used by SettingsService for key-value configuration
-- scoped to users, teams, or organizations.

CREATE TABLE IF NOT EXISTS public.settings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text        NOT NULL,
  value      text        NOT NULL,
  type       text        NOT NULL DEFAULT 'string'
               CHECK (type IN ('string', 'number', 'boolean', 'object', 'array')),
  scope      text        NOT NULL
               CHECK (scope IN ('user', 'team', 'organization')),
  scope_id   text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, scope, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_settings_scope_scope_id
  ON public.settings (scope, scope_id);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Organization-scoped settings: readable by active tenant members
CREATE POLICY "org_scope_select" ON public.settings
  FOR SELECT TO authenticated
  USING (
    scope = 'organization' AND EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.tenant_id = settings.scope_id
        AND ut.user_id = auth.uid()::text
        AND ut.status = 'active'
    )
  );

-- User-scoped settings: readable by the owning user only
CREATE POLICY "user_scope_select" ON public.settings
  FOR SELECT TO authenticated
  USING (
    scope = 'user'
    AND scope_id = auth.uid()::text
  );

-- Team-scoped settings: readable by members of the team's tenant
CREATE POLICY "team_scope_select" ON public.settings
  FOR SELECT TO authenticated
  USING (
    scope = 'team'
    AND EXISTS (
      SELECT 1
      FROM public.teams t
      JOIN public.user_tenants ut ON ut.tenant_id = t.tenant_id
      WHERE t.id::text = settings.scope_id
        AND ut.user_id = auth.uid()::text
        AND ut.status = 'active'
    )
  );

GRANT ALL ON public.settings TO service_role;
GRANT SELECT ON public.settings TO authenticated;
