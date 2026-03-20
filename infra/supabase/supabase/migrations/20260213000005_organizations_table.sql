-- Creates public.organizations, which is referenced by the provision_tenant RPC
-- and multiple backend services. This table was missing from the active migration
-- set despite being assumed by migrations from 20260304 onward.
--
-- Note: tenants.id is text (not uuid) per the canonical_identity_baseline.

CREATE TABLE IF NOT EXISTS public.organizations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        varchar(255) NOT NULL,
  slug        varchar(100),
  tier        text        NOT NULL DEFAULT 'free'
                CHECK (tier IN ('free', 'starter', 'professional', 'enterprise')),
  is_active   boolean     NOT NULL DEFAULT true,
  status      varchar(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'suspended', 'deleted')),
  settings    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_key
  ON public.organizations (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_tenant_id
  ON public.organizations (tenant_id);

CREATE INDEX IF NOT EXISTS idx_organizations_status
  ON public.organizations (status);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.organizations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "members_select" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.tenant_id = organizations.tenant_id
        AND ut.user_id = auth.uid()::text
        AND ut.status = 'active'
    )
  );

GRANT ALL ON public.organizations TO service_role;
GRANT SELECT ON public.organizations TO authenticated;
GRANT SELECT ON public.organizations TO anon;
