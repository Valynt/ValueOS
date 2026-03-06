-- Security governance checks for Supabase/Postgres schema hardening.
-- Execute with:
--   supabase db query --file infra/supabase/sql/ops/security-governance-checks.sql
-- or:
--   psql "$DATABASE_URL" -f infra/supabase/sql/ops/security-governance-checks.sql

-- 1) Tenant-like tables missing RLS (tenant_id or organization_id columns).
SELECT
  'missing_rls_on_tenant_table' AS check_name,
  table_schema,
  table_name
FROM information_schema.columns c
JOIN pg_catalog.pg_class pc
  ON pc.relname = c.table_name
JOIN pg_catalog.pg_namespace pn
  ON pn.oid = pc.relnamespace
  AND pn.nspname = c.table_schema
WHERE c.table_schema = 'public'
  AND c.column_name IN ('tenant_id', 'organization_id')
  AND pc.relkind = 'r'
  AND pc.relrowsecurity = false
GROUP BY table_schema, table_name
ORDER BY table_name;

-- 2) PUBLIC grants on tables/views.
SELECT
  'public_table_grant' AS check_name,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'PUBLIC'
  AND table_schema = 'public'
ORDER BY table_name, privilege_type;

-- 3) PUBLIC grants on sequences.
SELECT
  'public_sequence_grant' AS check_name,
  n.nspname AS sequence_schema,
  c.relname AS sequence_name,
  p.privilege_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('S', c.relowner))) AS p
WHERE c.relkind = 'S'
  AND n.nspname = 'public'
  AND p.grantee = 0
ORDER BY sequence_name, privilege_type;

-- 4) Views not set to SECURITY INVOKER.
-- reloptions contains security_invoker=true for invoker views on supported PostgreSQL versions.
SELECT
  'view_not_security_invoker' AS check_name,
  n.nspname AS view_schema,
  c.relname AS view_name,
  c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND (
    c.reloptions IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM unnest(c.reloptions) opt
      WHERE opt = 'security_invoker=true'
    )
  )
ORDER BY view_name;
