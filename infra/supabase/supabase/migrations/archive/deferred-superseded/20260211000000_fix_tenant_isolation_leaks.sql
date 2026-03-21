-- ============================================================================
-- Fix Broken Access Control: Standardize Tenant Isolation
-- Migration: 20260211000000_fix_tenant_isolation_leaks.sql
-- ============================================================================

-- Add tenant_id column to all tables that have organization_id but not tenant_id
-- Populate tenant_id with organization_id::text
-- Enforce RLS using security.user_has_tenant_access(tenant_id)

DO $$
DECLARE
  r RECORD;
  tenant_col_exists BOOLEAN;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'organization_id'
      AND table_name NOT IN ('tenants', 'user_tenants') -- Skip core tenant tables
  LOOP
    -- Check if tenant_id already exists
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.table_schema
        AND table_name = r.table_name
        AND column_name = 'tenant_id'
    ) INTO tenant_col_exists;

    IF NOT tenant_col_exists THEN
      -- Add tenant_id column
      EXECUTE format('ALTER TABLE %I.%I ADD COLUMN tenant_id TEXT;', r.table_schema, r.table_name);

      -- Populate tenant_id from organization_id
      EXECUTE format('UPDATE %I.%I SET tenant_id = organization_id::TEXT WHERE organization_id IS NOT NULL;', r.table_schema, r.table_name);

      -- Make tenant_id NOT NULL if organization_id is NOT NULL
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = r.table_schema
          AND table_name = r.table_name
          AND column_name = 'organization_id'
          AND is_nullable = 'NO'
      ) THEN
        EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN tenant_id SET NOT NULL;', r.table_schema, r.table_name);
      END IF;

      -- Add index on tenant_id
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant_id ON %I.%I (tenant_id);', r.table_name, r.table_schema, r.table_name);
    END IF;

    -- Enable RLS and add policies
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;', r.table_schema, r.table_name);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY;', r.table_schema, r.table_name);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON %I.%I;', r.table_schema, r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON %I.%I;', r.table_schema, r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON %I.%I;', r.table_schema, r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON %I.%I;', r.table_schema, r.table_name);

    EXECUTE format(
      'CREATE POLICY tenant_isolation_select ON %I.%I AS RESTRICTIVE FOR SELECT USING (security.user_has_tenant_access(tenant_id));',
      r.table_schema, r.table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_insert ON %I.%I AS RESTRICTIVE FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id));',
      r.table_schema, r.table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_update ON %I.%I AS RESTRICTIVE FOR UPDATE USING (security.user_has_tenant_access(tenant_id)) WITH CHECK (security.user_has_tenant_access(tenant_id));',
      r.table_schema, r.table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_delete ON %I.%I AS RESTRICTIVE FOR DELETE USING (security.user_has_tenant_access(tenant_id));',
      r.table_schema, r.table_name
    );
  END LOOP;
END $$;

-- For tables that already have tenant_id, ensure RLS is enforced
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'tenant_id'
      AND table_name NOT IN ('tenants', 'user_tenants')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;', r.table_schema, r.table_name);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY;', r.table_schema, r.table_name);

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON %I.%I;', r.table_schema, r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON %I.%I;', r.table_schema, r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON %I.%I;', r.table_schema, r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON %I.%I;', r.table_schema, r.table_name);

    EXECUTE format(
      'CREATE POLICY tenant_isolation_select ON %I.%I AS RESTRICTIVE FOR SELECT USING (security.user_has_tenant_access(tenant_id));',
      r.table_schema, r.table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_insert ON %I.%I AS RESTRICTIVE FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id));',
      r.table_schema, r.table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_update ON %I.%I AS RESTRICTIVE FOR UPDATE USING (security.user_has_tenant_access(tenant_id)) WITH CHECK (security.user_has_tenant_access(tenant_id));',
      r.table_schema, r.table_name
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation_delete ON %I.%I AS RESTRICTIVE FOR DELETE USING (security.user_has_tenant_access(tenant_id));',
      r.table_schema, r.table_name
    );
  END LOOP;
END $$;

-- Ensure service_role can bypass RLS for admin operations
-- (Already handled in existing policies for llm_usage and llm_gating_policies)

-- Validate that all tenant-scoped tables now have RLS
DO $$
DECLARE
  table_count INTEGER;
  rls_enabled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name IN ('organization_id', 'tenant_id')
    AND table_name NOT IN ('tenants', 'user_tenants');

  SELECT COUNT(DISTINCT table_name) INTO rls_enabled_count
  FROM information_schema.columns c
  JOIN pg_class pgc ON pgc.relname = c.table_name
  JOIN pg_namespace pgn ON pgn.oid = pgc.relnamespace AND pgn.nspname = c.table_schema
  WHERE c.table_schema = 'public'
    AND c.column_name IN ('organization_id', 'tenant_id')
    AND c.table_name NOT IN ('tenants', 'user_tenants')
    AND pgc.relrowsecurity = true;

  IF table_count != rls_enabled_count THEN
    RAISE WARNING 'Not all tenant tables have RLS enabled. Tables: %, RLS enabled: %', table_count, rls_enabled_count;
  ELSE
    RAISE NOTICE 'All % tenant tables have RLS enabled.', table_count;
  END IF;
END $$;</content>
<parameter name="filePath">/home/ino/ValueOS/infra/supabase/migrations/20260211000000_fix_tenant_isolation_leaks.sql
