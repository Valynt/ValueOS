-- ============================================================================
-- Tenant Isolation via RLS + request tenant context (SET LOCAL app.tenant_id)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS security;

CREATE OR REPLACE FUNCTION security.current_tenant_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.tenant_id', true), ''),
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id'),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')
  );
$$;

CREATE OR REPLACE FUNCTION security.current_tenant_id_uuid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(security.current_tenant_id(), '')::uuid;
$$;

-- Backwards-compatible helper used by earlier migrations
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT security.current_tenant_id_uuid();
$$;

-- Security barrier view for scoped access (prevents predicate pushdown issues)
CREATE OR REPLACE VIEW security.memory_value_cases_scoped
WITH (security_barrier = true)
AS
  SELECT *
  FROM public.memory_value_cases
  WHERE tenant_id = security.current_tenant_id_uuid();

-- Enable RLS and enforce tenant isolation on memory_* tables with tenant_id columns
DO $$
DECLARE
  r RECORD;
  tenant_expr TEXT;
BEGIN
  FOR r IN
    SELECT table_name, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'tenant_id'
      AND table_name LIKE 'memory_%'
  LOOP
    tenant_expr := 'security.user_has_tenant_access(tenant_id)';

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON public.%I;', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON public.%I;', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON public.%I;', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON public.%I;', r.table_name);

    EXECUTE format(
      'CREATE POLICY tenant_isolation_select ON public.%I FOR SELECT USING (%s);',
      r.table_name,
      tenant_expr
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_insert ON public.%I FOR INSERT WITH CHECK (%s);',
      r.table_name,
      tenant_expr
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_update ON public.%I FOR UPDATE USING (%s) WITH CHECK (%s);',
      r.table_name,
      tenant_expr,
      tenant_expr
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_delete ON public.%I FOR DELETE USING (%s);',
      r.table_name,
      tenant_expr
    );
  END LOOP;
END $$;

-- Explicit RLS for tenant root table (no tenant_id column)
ALTER TABLE public.memory_tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS memory_tenants_select ON public.memory_tenants;
DROP POLICY IF EXISTS memory_tenants_insert ON public.memory_tenants;
DROP POLICY IF EXISTS memory_tenants_update ON public.memory_tenants;
DROP POLICY IF EXISTS memory_tenants_delete ON public.memory_tenants;

CREATE POLICY memory_tenants_select ON public.memory_tenants
  FOR SELECT
  USING (id = security.current_tenant_id_uuid());

CREATE POLICY memory_tenants_insert ON public.memory_tenants
  FOR INSERT
  WITH CHECK (id = security.current_tenant_id_uuid());

CREATE POLICY memory_tenants_update ON public.memory_tenants
  FOR UPDATE
  USING (id = security.current_tenant_id_uuid())
  WITH CHECK (id = security.current_tenant_id_uuid());

CREATE POLICY memory_tenants_delete ON public.memory_tenants
  FOR DELETE
  USING (id = security.current_tenant_id_uuid());
