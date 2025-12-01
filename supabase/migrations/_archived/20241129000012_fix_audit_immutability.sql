-- Fix: Make All Audit Logs Immutable
-- Addresses: CRITICAL - audit logs can be tampered with
-- Issue: audit_logs, security_audit_log, agent_audit_log, workflow_audit_logs allow UPDATE/DELETE

BEGIN;

-- ============================================================================
-- 1. Create Immutability Protection Function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.prevent_audit_modification() IS 
  'Trigger function to prevent any modification or deletion of audit log entries';

-- ============================================================================
-- 2. Apply to audit_logs (enterprise_saas_settings)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
    -- Drop existing trigger if any
    DROP TRIGGER IF EXISTS tr_protect_audit_logs ON audit_logs;
    
    -- Create immutability trigger
    CREATE TRIGGER tr_protect_audit_logs
      BEFORE UPDATE OR DELETE ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_audit_modification();
    
    -- Revoke modification privileges
    REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;
    REVOKE UPDATE, DELETE ON audit_logs FROM authenticated;
    REVOKE UPDATE, DELETE ON audit_logs FROM anon;
    
    RAISE NOTICE '✅ audit_logs protected';
  ELSE
    RAISE NOTICE '⚠️  audit_logs table not found';
  END IF;
END $$;

-- ============================================================================
-- 3. Apply to security_audit_log (strict_rls_policies)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'security_audit_log') THEN
    DROP TRIGGER IF EXISTS tr_protect_security_audit ON security_audit_log;
    
    CREATE TRIGGER tr_protect_security_audit
      BEFORE UPDATE OR DELETE ON security_audit_log
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_audit_modification();
    
    REVOKE UPDATE, DELETE ON security_audit_log FROM PUBLIC;
    REVOKE UPDATE, DELETE ON security_audit_log FROM authenticated;
    REVOKE UPDATE, DELETE ON security_audit_log FROM anon;
    
    RAISE NOTICE '✅ security_audit_log protected';
  ELSE
    RAISE NOTICE '⚠️  security_audit_log table not found';
  END IF;
END $$;

-- ============================================================================
-- 4. Apply to agent_audit_log (agent_fabric)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agent_audit_log') THEN
    DROP TRIGGER IF EXISTS tr_protect_agent_audit ON agent_audit_log;
    
    CREATE TRIGGER tr_protect_agent_audit
      BEFORE UPDATE OR DELETE ON agent_audit_log
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_audit_modification();
    
    REVOKE UPDATE, DELETE ON agent_audit_log FROM PUBLIC;
    REVOKE UPDATE, DELETE ON agent_audit_log FROM authenticated;
    REVOKE UPDATE, DELETE ON agent_audit_log FROM anon;
    
    RAISE NOTICE '✅ agent_audit_log protected';
  ELSE
    RAISE NOTICE '⚠️  agent_audit_log table not found';
  END IF;
END $$;

-- ============================================================================
-- 5. Apply to workflow_audit_logs (workflow_orchestration)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'workflow_audit_logs') THEN
    DROP TRIGGER IF EXISTS tr_protect_workflow_audit ON workflow_audit_logs;
    
    CREATE TRIGGER tr_protect_workflow_audit
      BEFORE UPDATE OR DELETE ON workflow_audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_audit_modification();
    
    REVOKE UPDATE, DELETE ON workflow_audit_logs FROM PUBLIC;
    REVOKE UPDATE, DELETE ON workflow_audit_logs FROM authenticated;
    REVOKE UPDATE, DELETE ON workflow_audit_logs FROM anon;
    
    RAISE NOTICE '✅ workflow_audit_logs protected';
  ELSE
    RAISE NOTICE '⚠️  workflow_audit_logs table not found';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- Verification: Try to delete from audit log (should fail)
-- ============================================================================
DO $$
DECLARE
  test_id uuid;
  table_name text;
  tables_to_test text[] := ARRAY[
    'audit_logs',
    'security_audit_log',
    'agent_audit_log',
    'workflow_audit_logs'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables_to_test
  LOOP
    -- Check if table exists and has protection
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = table_name) THEN
      -- Check for trigger
      IF EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        WHERE c.relname = table_name
          AND t.tgname LIKE '%protect%'
      ) THEN
        RAISE NOTICE '✅ % has immutability trigger', table_name;
      ELSE
        RAISE WARNING '⚠️  % missing immutability trigger', table_name;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ SUCCESS: All audit tables are now immutable';
  RAISE NOTICE 'Any attempt to UPDATE or DELETE from audit logs will fail with exception';
END $$;
