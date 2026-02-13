-- RLS Lint Harness (CI blocking)
-- Source of truth for schema + RLS policies: infra/postgres/migrations
-- Legacy bootstrap migrations under infra/migrations are not used for CI validation.

DO $$
DECLARE
  missing_rls_tables text;
BEGIN
  SELECT string_agg(format('%I.%I', n.nspname, c.relname), ', ' ORDER BY n.nspname, c.relname)
  INTO missing_rls_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p')
    AND n.nspname IN ('public')
    AND c.relname NOT IN ('schema_migrations', 'spatial_ref_sys')
    AND NOT c.relrowsecurity;

  IF missing_rls_tables IS NOT NULL THEN
    RAISE EXCEPTION 'RLS must be enabled on all target tables. Missing: %', missing_rls_tables;
  END IF;
END $$;

DO $$
DECLARE
  missing_tenant_column_tables text;
BEGIN
  SELECT string_agg(format('%I.%I', c.table_schema, c.table_name), ', ' ORDER BY c.table_schema, c.table_name)
  INTO missing_tenant_column_tables
  FROM (
    SELECT
      table_schema,
      table_name,
      bool_or(column_name IN ('tenant_id', 'organization_id')) AS has_tenant_column
    FROM information_schema.columns
    WHERE table_schema IN ('public')
      AND table_name NOT IN ('schema_migrations', 'spatial_ref_sys')
    GROUP BY table_schema, table_name
  ) c
  WHERE NOT c.has_tenant_column;

  IF missing_tenant_column_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Tenant-scoped tables must include tenant_id/organization_id. Missing: %', missing_tenant_column_tables;
  END IF;
END $$;

DO $$
DECLARE
  missing_tenant_policy_tables text;
BEGIN
  SELECT string_agg(format('%I.%I', t.schemaname, t.tablename), ', ' ORDER BY t.schemaname, t.tablename)
  INTO missing_tenant_policy_tables
  FROM (
    SELECT
      n.nspname AS schemaname,
      c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p')
      AND n.nspname IN ('public')
      AND c.relname NOT IN ('schema_migrations', 'spatial_ref_sys')
  ) t
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = t.schemaname
      AND p.tablename = t.tablename
      AND (
        coalesce(p.qual, '') ~* '(tenant_id|organization_id)'
        OR coalesce(p.with_check, '') ~* '(tenant_id|organization_id)'
      )
  );

  IF missing_tenant_policy_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Tenant-scoped policies are required on all target tables. Missing: %', missing_tenant_policy_tables;
  END IF;
END $$;

-- Check 4: No permissive USING (true) policies targeting the authenticated role.
-- service_role policies with USING (true) are acceptable since service_role
-- bypasses RLS. Authenticated users must always go through tenant membership checks.
DO $$
DECLARE
  permissive_policies text;
BEGIN
  SELECT string_agg(
    format('%I.%I policy=%I', p.schemaname, p.tablename, p.policyname),
    ', ' ORDER BY p.schemaname, p.tablename
  )
  INTO permissive_policies
  FROM pg_policies p
  WHERE p.schemaname IN ('public')
    AND p.permissive = 'PERMISSIVE'
    AND p.roles @> ARRAY['authenticated']
    AND (
      coalesce(p.qual, '') = '(true)'
      OR coalesce(p.with_check, '') = '(true)'
    );

  IF permissive_policies IS NOT NULL THEN
    RAISE EXCEPTION 'Permissive USING (true) policies on authenticated role detected (tenant isolation breach): %', permissive_policies;
  END IF;
END $$;
