-- ============================================================================
-- Enforce tenant claim isolation via auth.jwt() for tenant-scoped policies
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS security;

-- Prefer auth.jwt() claim for tenant scoping, with fallbacks for legacy contexts.
CREATE OR REPLACE FUNCTION security.current_tenant_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF((auth.jwt() -> 'app_metadata' ->> 'tenant_id'), ''),
    NULLIF((auth.jwt() ->> 'tenant_id'), ''),
    NULLIF((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id'), ''),
    NULLIF((current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id'), ''),
    NULLIF(current_setting('app.tenant_id', true), '')
  );
$$;

CREATE OR REPLACE FUNCTION security.current_tenant_id_uuid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(security.current_tenant_id(), '')::uuid;
$$;

-- Require both a matching JWT tenant claim and an active membership.
CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND target_tenant_id IS NOT NULL
    AND security.current_tenant_id() IS NOT NULL
    AND security.current_tenant_id() = target_tenant_id
    AND EXISTS (
      SELECT 1
      FROM public.user_tenants AS ut
      WHERE ut.user_id = (auth.uid())::text
        AND ut.tenant_id = target_tenant_id
        AND ut.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION security.user_has_tenant_access(target_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT security.user_has_tenant_access(target_tenant_id::text);
$$;

-- Refresh tenant membership helper to enforce JWT tenant claim alignment.
CREATE OR REPLACE FUNCTION security.is_current_user_tenant_member(p_tenant_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    security.current_tenant_id() = p_tenant_id
    AND EXISTS (
      SELECT 1
      FROM public.user_tenants ut
      WHERE ut.tenant_id = p_tenant_id
        AND ut.user_id = auth.uid()::text
        AND ut.status = 'active'
    );
$$;

-- Harden user_tenants policies to require the JWT tenant claim.
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_select ON public.user_tenants;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.user_tenants;
DROP POLICY IF EXISTS tenant_isolation_update ON public.user_tenants;
DROP POLICY IF EXISTS tenant_isolation_delete ON public.user_tenants;

CREATE POLICY tenant_isolation_select ON public.user_tenants
AS RESTRICTIVE
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND tenant_id = security.current_tenant_id()
  AND user_id = (auth.uid())::text
  AND status = 'active'
);

CREATE POLICY tenant_isolation_insert ON public.user_tenants
AS RESTRICTIVE
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND tenant_id = security.current_tenant_id()
  AND user_id = (auth.uid())::text
  AND status = 'active'
);

CREATE POLICY tenant_isolation_update ON public.user_tenants
AS RESTRICTIVE
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND tenant_id = security.current_tenant_id()
  AND user_id = (auth.uid())::text
  AND status = 'active'
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND tenant_id = security.current_tenant_id()
  AND user_id = (auth.uid())::text
  AND status = 'active'
);

CREATE POLICY tenant_isolation_delete ON public.user_tenants
AS RESTRICTIVE
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND tenant_id = security.current_tenant_id()
  AND user_id = (auth.uid())::text
  AND status = 'active'
);
