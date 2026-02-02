-- RLS Linting Rules Test
-- Ensures all tables have proper RLS policies and tenant isolation

-- Test 1: All tables must have RLS enabled
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN ('schema_migrations', 'spatial_ref_sys')
AND NOT rowsecurity
ORDER BY tablename;

-- Test 2: All tables must have organization_id or tenant_id column for multi-tenancy
SELECT table_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name NOT IN ('schema_migrations', 'spatial_ref_sys')
AND table_name NOT LIKE '%_pkey'
GROUP BY table_name
HAVING NOT (bool_or(column_name = 'organization_id') OR bool_or(column_name = 'tenant_id'))
ORDER BY table_name;

-- Test 3: All policies must include tenant filter
SELECT schemaname, tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
AND (qual NOT LIKE '%organization_id%' AND qual NOT LIKE '%tenant_id%')
ORDER BY tablename, policyname;
