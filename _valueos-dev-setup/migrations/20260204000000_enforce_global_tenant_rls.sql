-- ============================================================================
-- Enforce Tenant RLS Across All Tenant-Scoped Tables (Kernel-Level Isolation)
-- ============================================================================

-- Prefer cryptographically signed tenant context (JWT claims) over mutable session config.
CREATE OR REPLACE FUNCTION security.current_tenant_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
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

-- Apply restrictive tenant policies to every table with a tenant_id column.
DO $$
DECLARE
  r RECORD;
  tenant_expr TEXT;
BEGIN
  FOR r IN
    SELECT table_schema, table_name, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'tenant_id'
  LOOP
    tenant_expr := 'security.user_has_tenant_access(tenant_id)';

    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;', r.table_schema, r.table_name);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY;', r.table_schema, r.table_name);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON %I.%I;', r.table_schema, r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON %I.%I;', r.table_schema, r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON %I.%I;', r.table_schema, r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON %I.%I;', r.table_schema, r.table_name);

    EXECUTE format(
      'CREATE POLICY tenant_isolation_select ON %I.%I AS RESTRICTIVE FOR SELECT USING (%s);',
      r.table_schema,
      r.table_name,
      tenant_expr
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_insert ON %I.%I AS RESTRICTIVE FOR INSERT WITH CHECK (%s);',
      r.table_schema,
      r.table_name,
      tenant_expr
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_update ON %I.%I AS RESTRICTIVE FOR UPDATE USING (%s) WITH CHECK (%s);',
      r.table_schema,
      r.table_name,
      tenant_expr,
      tenant_expr
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_delete ON %I.%I AS RESTRICTIVE FOR DELETE USING (%s);',
      r.table_schema,
      r.table_name,
      tenant_expr
    );
  END LOOP;
END $$;
