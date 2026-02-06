-- ==========================================================================
-- Enable tenant isolation RLS for invitations
-- ==========================================================================

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_select ON public.invitations;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.invitations;
DROP POLICY IF EXISTS tenant_isolation_update ON public.invitations;
DROP POLICY IF EXISTS tenant_isolation_delete ON public.invitations;

CREATE POLICY tenant_isolation_select ON public.invitations
AS RESTRICTIVE
FOR SELECT
USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY tenant_isolation_insert ON public.invitations
AS RESTRICTIVE
FOR INSERT
WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY tenant_isolation_update ON public.invitations
AS RESTRICTIVE
FOR UPDATE
USING (security.user_has_tenant_access(tenant_id))
WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY tenant_isolation_delete ON public.invitations
AS RESTRICTIVE
FOR DELETE
USING (security.user_has_tenant_access(tenant_id));
