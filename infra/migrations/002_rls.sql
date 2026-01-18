-- 002_rls.sql
BEGIN;

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Optional: force RLS even for table owners
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.membership_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;

-- =========================
-- Helper predicate: user is active member of current tenant
-- =========================

CREATE OR REPLACE FUNCTION app.is_active_member(_tenant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.tenant_id = _tenant_id
      AND m.user_id = _user_id
      AND m.status = 'active'
  )
$$;

-- =========================
-- Tenants: can read only tenants you are a member of
-- =========================

DROP POLICY IF EXISTS tenants_select ON public.tenants;
CREATE POLICY tenants_select
ON public.tenants
FOR SELECT
USING (
  app.is_active_member(tenants.id, app.current_user_id())
);

-- (Optional) Tenants updates only by owners; simplest approach: check membership.is_owner
DROP POLICY IF EXISTS tenants_update_owner ON public.tenants;
CREATE POLICY tenants_update_owner
ON public.tenants
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.tenant_id = tenants.id
      AND m.user_id = app.current_user_id()
      AND m.status = 'active'
      AND m.is_owner = true
  )
)
WITH CHECK (
  -- ensure updates don't move tenant id; always true for tenants
  true
);

-- =========================
-- Users: global table, but limit reads to "users in my current tenant"
-- =========================

DROP POLICY IF EXISTS users_select_in_tenant ON public.users;
CREATE POLICY users_select_in_tenant
ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.user_id = users.id
      AND m.tenant_id = app.current_tenant_id()
      AND app.is_active_member(m.tenant_id, app.current_user_id())
  )
);

-- Allow a user to read/update their own profile (optional)
DROP POLICY IF EXISTS users_self_update ON public.users;
CREATE POLICY users_self_update
ON public.users
FOR UPDATE
USING (users.id = app.current_user_id())
WITH CHECK (users.id = app.current_user_id());

-- =========================
-- Memberships: scoped to current tenant
-- =========================

DROP POLICY IF EXISTS memberships_tenant_scope ON public.memberships;
CREATE POLICY memberships_tenant_scope
ON public.memberships
FOR SELECT
USING (
  memberships.tenant_id = app.current_tenant_id()
  AND app.is_active_member(app.current_tenant_id(), app.current_user_id())
);

-- Allow owners to manage memberships (invite/disable). Adjust to your model.
DROP POLICY IF EXISTS memberships_owner_manage ON public.memberships;
CREATE POLICY memberships_owner_manage
ON public.memberships
FOR UPDATE
USING (
  memberships.tenant_id = app.current_tenant_id()
  AND EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.tenant_id = app.current_tenant_id()
      AND m.user_id = app.current_user_id()
      AND m.status = 'active'
      AND m.is_owner = true
  )
)
WITH CHECK (memberships.tenant_id = app.current_tenant_id());

-- =========================
-- Roles + Membership Roles: tenant-scoped
-- =========================

DROP POLICY IF EXISTS roles_tenant_scope ON public.roles;
CREATE POLICY roles_tenant_scope
ON public.roles
FOR SELECT
USING (
  roles.tenant_id = app.current_tenant_id()
  AND app.is_active_member(app.current_tenant_id(), app.current_user_id())
);

DROP POLICY IF EXISTS membership_roles_tenant_scope ON public.membership_roles;
CREATE POLICY membership_roles_tenant_scope
ON public.membership_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.roles r ON r.id = membership_roles.role_id
    WHERE m.id = membership_roles.membership_id
      AND m.tenant_id = app.current_tenant_id()
      AND r.tenant_id = app.current_tenant_id()
      AND app.is_active_member(app.current_tenant_id(), app.current_user_id())
  )
);

-- =========================
-- Permissions: global dictionary (safe to read for active users)
-- =========================

DROP POLICY IF EXISTS permissions_read_all ON public.permissions;
CREATE POLICY permissions_read_all
ON public.permissions
FOR SELECT
USING (app.current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS role_permissions_tenant_scope ON public.role_permissions;
CREATE POLICY role_permissions_tenant_scope
ON public.role_permissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.roles r
    WHERE r.id = role_permissions.role_id
      AND r.tenant_id = app.current_tenant_id()
      AND app.is_active_member(app.current_tenant_id(), app.current_user_id())
  )
);

-- =========================
-- Sessions: tenant-scoped (or self-scoped)
-- =========================

DROP POLICY IF EXISTS sessions_self_or_tenant_owner ON public.sessions;
CREATE POLICY sessions_self_or_tenant_owner
ON public.sessions
FOR SELECT
USING (
  sessions.tenant_id = app.current_tenant_id()
  AND (
    sessions.user_id = app.current_user_id()
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.tenant_id = app.current_tenant_id()
        AND m.user_id = app.current_user_id()
        AND m.status = 'active'
        AND m.is_owner = true
    )
  )
);

-- =========================
-- Audit log: tenant-scoped read; writes typically only via server role
-- =========================

DROP POLICY IF EXISTS audit_tenant_read ON public.audit_log;
CREATE POLICY audit_tenant_read
ON public.audit_log
FOR SELECT
USING (
  (audit_log.tenant_id = app.current_tenant_id())
  AND app.is_active_member(app.current_tenant_id(), app.current_user_id())
);

COMMIT;
