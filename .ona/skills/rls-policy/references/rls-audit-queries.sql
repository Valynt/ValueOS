-- RLS audit queries — run against the local Supabase instance to identify gaps.

-- ============================================================================
-- 1. Tables with RLS disabled
-- ============================================================================
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT relname
    FROM pg_class
    WHERE relrowsecurity = true
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  )
ORDER BY tablename;

-- ============================================================================
-- 2. Tables with RLS enabled but no policies (blocks all access)
-- ============================================================================
SELECT c.relname AS table_name
FROM pg_class c
WHERE c.relrowsecurity = true
  AND c.relkind = 'r'
  AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND NOT EXISTS (
    SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid
  )
ORDER BY c.relname;

-- ============================================================================
-- 3. All policies on a specific table (replace <table_name>)
-- ============================================================================
SELECT
  polname   AS policy_name,
  polcmd    AS operation,   -- r=SELECT, a=INSERT, w=UPDATE, d=DELETE, *=ALL
  polpermissive AS permissive,
  pg_get_expr(polqual, polrelid)    AS using_expr,
  pg_get_expr(polwithcheck, polrelid) AS with_check_expr
FROM pg_policy
WHERE polrelid = 'public.<table_name>'::regclass
ORDER BY polcmd, polname;

-- ============================================================================
-- 4. Tables missing an organization_id column (cannot have tenant-scoped RLS)
-- ============================================================================
SELECT t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = t.tablename
      AND c.column_name = 'organization_id'
  )
ORDER BY t.tablename;

-- ============================================================================
-- 5. Policies using raw JWT claim instead of security.user_has_tenant_access
--    (weaker — does not verify user_tenants membership)
-- ============================================================================
SELECT
  c.relname AS table_name,
  p.polname AS policy_name,
  pg_get_expr(p.polqual, p.polrelid) AS using_expr
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (
    pg_get_expr(p.polqual, p.polrelid) ILIKE '%auth.jwt()%'
    OR pg_get_expr(p.polwithcheck, p.polrelid) ILIKE '%auth.jwt()%'
  )
ORDER BY c.relname, p.polname;
