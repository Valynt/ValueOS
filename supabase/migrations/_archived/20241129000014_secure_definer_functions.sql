-- Fix: Secure SECURITY DEFINER Functions
-- Addresses: Potential privilege escalation via search_path attacks
-- Issue: 10 SECURITY DEFINER functions lack search_path configuration

BEGIN;

-- ============================================================================
-- 1. Set search_path on ALL SECURITY DEFINER Functions
-- ============================================================================
DO $$
DECLARE
  func record;
  fixed_count int := 0;
BEGIN
  FOR func IN 
    SELECT 
      n.nspname as schema,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args,
      p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true  -- SECURITY DEFINER
      AND n.nspname IN ('public', 'auth')
      AND (p.proconfig IS NULL OR NOT 'search_path' = ANY(p.proconfig))
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
        func.schema,
        func.function_name,
        func.args
      );
      
      fixed_count := fixed_count + 1;
      RAISE NOTICE '✅ Secured: %.%(%)', func.schema, func.function_name, func.args;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '⚠️  Could not secure %.%: %', func.schema, func.function_name, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '✅ Secured % SECURITY DEFINER functions', fixed_count;
END $$;

-- ============================================================================
-- 2. Revoke Public Execute on Sensitive Functions
-- ============================================================================

-- LLM Monitoring Functions (should be service_role or authenticated only)
DO $$
BEGIN
  -- track_llm_cost
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'track_llm_cost'
  ) THEN
    REVOKE EXECUTE ON FUNCTION track_llm_cost(uuid, text, integer, numeric) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION track_llm_cost(uuid, text, integer, numeric) TO service_role;
    RAISE NOTICE '✅ Restricted track_llm_cost to service_role';
  END IF;
  
  -- get_cost_summary
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'get_cost_summary'
  ) THEN
    REVOKE EXECUTE ON FUNCTION get_cost_summary(uuid, integer) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION get_cost_summary(uuid, integer) TO authenticated;
    RAISE NOTICE '✅ Restricted get_cost_summary to authenticated';
  END IF;
  
  -- check_rate_limit
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'check_rate_limit'
  ) THEN
    REVOKE EXECUTE ON FUNCTION check_rate_limit(uuid, text, integer, integer) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION check_rate_limit(uuid, text, integer, integer) TO authenticated, service_role;
    RAISE NOTICE '✅ Restricted check_rate_limit to authenticated/service_role';
  END IF;
  
  -- cleanup_old_llm_usage
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_llm_usage'
  ) THEN
    REVOKE EXECUTE ON FUNCTION cleanup_old_llm_usage(interval) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION cleanup_old_llm_usage(interval) TO service_role;
    RAISE NOTICE '✅ Restricted cleanup_old_llm_usage to service_role';
  END IF;
  
  -- send_cost_alert
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'send_cost_alert'
  ) THEN
    REVOKE EXECUTE ON FUNCTION send_cost_alert(uuid, numeric) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION send_cost_alert(uuid, numeric) TO service_role;
    RAISE NOTICE '✅ Restricted send_cost_alert to service_role';
  END IF;
END $$;

-- ============================================================================
-- 3. Tenant Integration Functions
-- ============================================================================

DO $$
BEGIN
  -- get_integration_credentials
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'get_integration_credentials'
  ) THEN
    REVOKE EXECUTE ON FUNCTION get_integration_credentials(uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION get_integration_credentials(uuid) TO authenticated;
    RAISE NOTICE '✅ Restricted get_integration_credentials to authenticated';
  END IF;
  
  -- log_integration_usage
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'log_integration_usage'
  ) THEN
    REVOKE EXECUTE ON FUNCTION log_integration_usage(uuid, text, jsonb) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION log_integration_usage(uuid, text, jsonb) TO authenticated, service_role;
    RAISE NOTICE '✅ Restricted log_integration_usage to authenticated/service_role';
  END IF;
END $$;

-- ============================================================================
-- 4. Comprehensive RLS Helper Functions
-- ============================================================================

DO $$
BEGIN
  -- current_user_tenant_id
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'current_user_tenant_id'
  ) THEN
    -- This function is used in RLS policies, so must be accessible
    GRANT EXECUTE ON FUNCTION current_user_tenant_id() TO authenticated;
    RAISE NOTICE '✅ Granted current_user_tenant_id to authenticated';
  END IF;
  
  -- is_tenant_admin
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'is_tenant_admin'
  ) THEN
    GRANT EXECUTE ON FUNCTION is_tenant_admin(uuid) TO authenticated;
    RAISE NOTICE '✅ Granted is_tenant_admin to authenticated';
  END IF;
  
  -- has_tenant_access
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'has_tenant_access'
  ) THEN
    GRANT EXECUTE ON FUNCTION has_tenant_access(uuid) TO authenticated;
    RAISE NOTICE '✅ Granted has_tenant_access to authenticated';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  unsafe_count int;
  total_definer_count int;
BEGIN
  -- Count SECURITY DEFINER functions without search_path
  SELECT count(*) INTO unsafe_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prosecdef = true
    AND n.nspname IN ('public', 'auth')
    AND (p.proconfig IS NULL OR NOT 'search_path' = ANY(p.proconfig));
  
  -- Count total SECURITY DEFINER functions
  SELECT count(*) INTO total_definer_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prosecdef = true
    AND n.nspname IN ('public', 'auth');
  
  IF unsafe_count > 0 THEN
    RAISE WARNING '⚠️  % SECURITY DEFINER functions still lack search_path', unsafe_count;
  ELSE
    RAISE NOTICE '✅ SUCCESS: All % SECURITY DEFINER functions are properly secured', total_definer_count;
  END IF;
  
  RAISE NOTICE 'Functions have restricted execute permissions';
  RAISE NOTICE 'search_path set to "public, pg_temp" on all SECURITY DEFINER functions';
END $$;

-- Query to verify configuration
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  p.prosecdef as is_security_definer,
  p.proconfig as configuration,
  CASE 
    WHEN 'search_path' = ANY(p.proconfig) THEN '✅ Secured'
    ELSE '❌ Unsafe'
  END as security_status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef = true
  AND n.nspname IN ('public', 'auth')
ORDER BY n.nspname, p.proname;
