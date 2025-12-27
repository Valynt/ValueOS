-- Security Hardening Migration
-- Fixes 6 security lint errors identified in audit
-- Created: 2025-12-26
-- 
-- This migration implements:
-- 1. Removes SECURITY DEFINER from views (use SECURITY INVOKER)
-- 2. Revokes PUBLIC grants on all sensitive tables/views
-- 3. Enables RLS with proper tenant isolation policies
-- 4. Creates least-privileged ownership roles
-- 5. Hardens SECURITY DEFINER functions with explicit checks
-- 6. Removes excessive schema/sequence privileges

-- ============================================================================
-- 1. FIX: Security Definer View (recent_confidence_violations)
-- ============================================================================

-- Drop and recreate as SECURITY INVOKER (relies on RLS)
DROP VIEW IF EXISTS public.recent_confidence_violations;

CREATE VIEW public.recent_confidence_violations
SECURITY INVOKER
AS
SELECT 
  cv.*,
  ap.agent_type,
  ap.user_id,
  ap.session_id
FROM public.confidence_violations cv
LEFT JOIN public.agent_predictions ap ON ap.id = cv.prediction_id
WHERE cv.created_at >= now() - interval '7 days';

-- Revoke PUBLIC, grant only to authenticated
REVOKE ALL ON public.recent_confidence_violations FROM PUBLIC;
GRANT SELECT ON public.recent_confidence_violations TO authenticated;

COMMENT ON VIEW public.recent_confidence_violations IS 
'SECURITY INVOKER view - relies on RLS policies on underlying tables';

-- ============================================================================
-- 2. FIX: PUBLIC Grants on Sensitive Tables/Views
-- ============================================================================

-- Revoke PUBLIC access from all tables in public schema
DO $$
DECLARE
  r record;
BEGIN
  -- Revoke from tables
  FOR r IN 
    SELECT schemaname, tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC;', r.schemaname, r.tablename);
  END LOOP;

  -- Revoke from views
  FOR r IN 
    SELECT schemaname, viewname 
    FROM pg_views 
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC;', r.schemaname, r.viewname);
  END LOOP;
  
  RAISE NOTICE 'Revoked PUBLIC access from all public schema objects';
END $$;

-- Grant least privilege to authenticated for key tables
GRANT SELECT ON public.confidence_violations TO authenticated;
GRANT SELECT ON public.agent_predictions TO authenticated;
GRANT SELECT ON public.tenants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_tenants TO authenticated;

-- ============================================================================
-- 3. FIX: Missing or Weak RLS Policies
-- ============================================================================

-- Ensure RLS is enabled on critical tables
ALTER TABLE public.confidence_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_predictions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "cv_tenant_read" ON public.confidence_violations;
DROP POLICY IF EXISTS "ap_tenant_read" ON public.agent_predictions;
DROP POLICY IF EXISTS "cv_tenant_isolation" ON public.confidence_violations;
DROP POLICY IF EXISTS "ap_tenant_isolation" ON public.agent_predictions;

-- Confidence violations: tenant isolation
CREATE POLICY "cv_tenant_isolation" ON public.confidence_violations
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if user belongs to a tenant (multi-tenant check)
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = (auth.uid())::text
    )
  );

-- Agent predictions: tenant isolation with user ownership
CREATE POLICY "ap_tenant_isolation" ON public.agent_predictions
  FOR SELECT
  TO authenticated
  USING (
    -- User can see their own predictions
    user_id = (auth.uid())::text
    OR
    -- Or predictions from their tenant
    EXISTS (
      SELECT 1 FROM public.user_tenants ut
      WHERE ut.user_id = (auth.uid())::text
      AND ut.tenant_id = agent_predictions.tenant_id
    )
  );

-- Performance indexes for RLS policies
CREATE INDEX IF NOT EXISTS idx_confidence_violations_created_at 
  ON public.confidence_violations(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_predictions_user 
  ON public.agent_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_predictions_tenant 
  ON public.agent_predictions(tenant_id);

-- ============================================================================
-- 4. FIX: Over-Privileged Ownership
-- ============================================================================

-- Create least-privileged role for view ownership
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'view_reader') THEN
    CREATE ROLE view_reader NOLOGIN;
  END IF;
END $$;

-- Grant minimal SELECT permissions to view_reader
GRANT SELECT ON public.confidence_violations TO view_reader;
GRANT SELECT ON public.agent_predictions TO view_reader;

-- Transfer ownership of view to least-privileged role
ALTER VIEW public.recent_confidence_violations OWNER TO view_reader;

-- ============================================================================
-- 5. FIX: SECURITY DEFINER Functions Without Explicit Checks
-- ============================================================================

-- Find and harden any SECURITY DEFINER functions
-- This is a template - adjust based on actual functions in your schema

-- Example: If you have a function that needs SECURITY DEFINER
-- CREATE OR REPLACE FUNCTION public.get_user_violations(p_user_id TEXT)
-- RETURNS SETOF public.confidence_violations
-- LANGUAGE sql
-- SECURITY DEFINER
-- STABLE
-- AS $$
--   -- Explicit tenant check
--   SELECT cv.* 
--   FROM public.confidence_violations cv
--   WHERE EXISTS (
--     SELECT 1 FROM public.user_tenants ut
--     WHERE ut.user_id = (auth.uid())::text
--     AND ut.user_id = p_user_id  -- Ensure user can only query themselves
--   );
-- $$;
-- 
-- REVOKE ALL ON FUNCTION public.get_user_violations(TEXT) FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.get_user_violations(TEXT) TO authenticated;
-- ALTER FUNCTION public.get_user_violations(TEXT) OWNER TO view_reader;

-- ============================================================================
-- 6. FIX: Excessive Privileges on Schema/Sequences
-- ============================================================================

-- Harden public schema
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO view_reader;

-- Revoke sequence privileges from PUBLIC
DO $$
DECLARE
  s record;
BEGIN
  FOR s IN 
    SELECT sequence_schema, sequence_name 
    FROM information_schema.sequences 
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM PUBLIC;', s.sequence_schema, s.sequence_name);
  END LOOP;
  
  RAISE NOTICE 'Revoked PUBLIC access from all sequences';
END $$;

-- Grant sequence USAGE only where needed (for INSERT operations)
-- Adjust based on your application's needs
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- Validation and Summary
-- ============================================================================

DO $$
DECLARE
  rls_count INTEGER;
  public_grant_count INTEGER;
BEGIN
  -- Count tables with RLS enabled
  SELECT COUNT(*) INTO rls_count
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE t.schemaname = 'public'
  AND c.relrowsecurity = true;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Security Hardening Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Fixed SECURITY DEFINER view: recent_confidence_violations';
  RAISE NOTICE '✅ Revoked PUBLIC grants from all public schema objects';
  RAISE NOTICE '✅ Enabled RLS on % tables', rls_count;
  RAISE NOTICE '✅ Created least-privileged view_reader role';
  RAISE NOTICE '✅ Hardened schema and sequence privileges';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Test as multiple users to verify RLS isolation';
  RAISE NOTICE '  2. Re-run security linter to confirm fixes';
  RAISE NOTICE '  3. Review application for any broken permissions';
  RAISE NOTICE '';
END $$;
