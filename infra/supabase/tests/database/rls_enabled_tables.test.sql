-- tests/database/rls_enabled_tables.test.sql
-- Validate tenant-scoped inventory has complete RLS and policy coverage.

BEGIN;
SELECT no_plan();

\ir ./tenant_scope_inventory.sql

-- Sanity: inventory itself should be deterministic and non-empty.
SELECT ok(
  (SELECT count(*) FROM tenant_scope_inventory) > 0,
  'tenant scope inventory is present'
);

-- Guardrail: every table that physically carries tenant_id/organization_id must be classified.
SELECT is_empty(
  $$
  SELECT format('%I.%I', c.table_schema, c.table_name) AS uncovered_table
  FROM (
    SELECT
      table_schema,
      table_name,
      bool_or(column_name IN ('tenant_id', 'organization_id')) AS has_tenant_column
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name NOT IN ('schema_migrations', 'spatial_ref_sys')
    GROUP BY table_schema, table_name
  ) c
  LEFT JOIN tenant_scope_inventory i
    ON i.schema_name = c.table_schema
   AND i.table_name = c.table_name
  WHERE c.has_tenant_column
    AND i.table_name IS NULL
  ORDER BY 1
  $$,
  'All tenant-column tables are explicitly listed in tenant scope inventory'
);

-- Tenant-scoped tables must exist.
SELECT is_empty(
  $$
  SELECT format('%I.%I', i.schema_name, i.table_name)
  FROM tenant_scope_inventory i
  LEFT JOIN pg_class c ON c.relname = i.table_name
  LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = i.schema_name
  WHERE n.oid IS NULL
  ORDER BY 1
  $$,
  'All tenant scope inventory tables exist in the schema'
);

-- Tenant-scoped tables must have RLS enabled.
SELECT is_empty(
  $$
  SELECT format('%I.%I', i.schema_name, i.table_name)
  FROM tenant_scope_inventory i
  JOIN pg_class c ON c.relname = i.table_name
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = i.schema_name
  WHERE NOT c.relrowsecurity
  ORDER BY 1
  $$,
  'RLS is enabled on every tenant-scoped table in the inventory'
);

-- Tenant-scoped tables must have at least one policy.
SELECT is_empty(
  $$
  SELECT format('%I.%I', i.schema_name, i.table_name)
  FROM tenant_scope_inventory i
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = i.schema_name
      AND p.tablename = i.table_name
  )
  ORDER BY 1
  $$,
  'Every tenant-scoped table in the inventory has at least one policy'
);

-- Tenant-scoped tables must have a policy predicate matching the required access model.
SELECT is_empty(
  $$
  SELECT format('%I.%I (%s)', i.schema_name, i.table_name, i.required_policy_description)
  FROM tenant_scope_inventory i
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = i.schema_name
      AND p.tablename = i.table_name
      AND (
        COALESCE(p.qual, '') ~* i.required_policy_regex
        OR COALESCE(p.with_check, '') ~* i.required_policy_regex
      )
  )
  ORDER BY 1
  $$,
  'Every tenant-scoped table has policy coverage matching its required predicate'
);

SELECT * FROM finish();
ROLLBACK;
