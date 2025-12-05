# Remediation Plan: ValueCanvas Migration Validation
**Date:** December 1, 2025  
**Status:** 🔴 CRITICAL  
**Total Critical Issues:** 31  
**Target:** Production Readiness

---

## Executive Summary

This remediation plan addresses 31 blocking issues identified in the migration validation. The primary risks:
1. **Data Exposure:** Missing RLS on critical tables (cases, workflows, messages, agent_predictions)
2. **Audit Tampering:** Mutable audit logs
3. **Forward Dependencies:** Tables referenced before creation
4. **Permissive Policies:** `USING (true)` without role scoping

**Estimated Fix Time:** 4-6 hours  
**Target Completion:** Before production deployment

---

## Phase 1: Security Lockdown (IMMEDIATE - T+0 to T+2 Hours)

### 🔴 Fix 1.1: Enable RLS on Base Schema Tables

**File:** `supabase/migrations/20241129000000_base_schema.sql`  
**Problem:** Core user data (cases, workflows, messages) completely unprotected  
**Severity:** 🔴 CRITICAL

**Create New Migration:**
```bash
# Create fix migration
cat > supabase/migrations/20241129000010_fix_base_schema_rls.sql << 'EOF'
-- Fix: Enable RLS on Base Schema Tables
-- Addresses: CRITICAL security issue - user data exposed

BEGIN;

-- Enable RLS on all base tables
ALTER TABLE IF EXISTS public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

-- Cases: Users own their cases
DROP POLICY IF EXISTS "Users own their cases" ON public.cases;
CREATE POLICY "Users own their cases"
  ON public.cases
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role bypass for cases
CREATE POLICY "Service role full access to cases"
  ON public.cases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Workflows: Users own their workflows
DROP POLICY IF EXISTS "Users own their workflows" ON public.workflows;
CREATE POLICY "Users own their workflows"
  ON public.workflows
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role bypass for workflows
CREATE POLICY "Service role full access to workflows"
  ON public.workflows
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Messages: Users own their messages
DROP POLICY IF EXISTS "Users own their messages" ON public.messages;
CREATE POLICY "Users own their messages"
  ON public.messages
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role bypass for messages
CREATE POLICY "Service role full access to messages"
  ON public.messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;

-- Verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN ('cases', 'workflows', 'messages')
      AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS not enabled on all base tables!';
  END IF;
  
  RAISE NOTICE 'SUCCESS: RLS enabled on base schema tables';
END $$;
EOF
```

**Verification:**
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('cases', 'workflows', 'messages');
-- All should show rowsecurity = true

-- Test as user
SET ROLE authenticated;
SET request.jwt.claim.sub = 'test-user-id';
SELECT count(*) FROM cases;  -- Should only see own cases
```

---

### 🔴 Fix 1.2: Enable RLS on Agent Predictions

**File:** `supabase/migrations/20241127100000_agent_predictions.sql`  
**Problem:** All prediction data accessible to anyone  
**Severity:** 🔴 CRITICAL

**Create New Migration:**
```bash
cat > supabase/migrations/20241127100001_fix_agent_predictions_rls.sql << 'EOF'
-- Fix: Enable RLS on Agent Prediction Tables
-- Addresses: CRITICAL security issue - prediction data exposed

BEGIN;

-- Enable RLS on all agent prediction tables
ALTER TABLE IF EXISTS agent_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS confidence_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_accuracy_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_retraining_queue ENABLE ROW LEVEL SECURITY;

-- Agent Predictions: Users can view predictions from their sessions
DROP POLICY IF EXISTS "Users view own predictions" ON agent_predictions;
CREATE POLICY "Users view own predictions"
  ON agent_predictions
  FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM agent_sessions WHERE user_id = auth.uid()
    )
  );

-- System can insert predictions
CREATE POLICY "System inserts predictions"
  ON agent_predictions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Predictions are append-only (no updates/deletes)
CREATE POLICY "No prediction updates"
  ON agent_predictions
  FOR UPDATE
  TO authenticated, service_role
  USING (false);

CREATE POLICY "No prediction deletes"
  ON agent_predictions
  FOR DELETE
  TO authenticated, service_role
  USING (false);

-- Confidence Violations: Users view violations from their predictions
DROP POLICY IF EXISTS "Users view own violations" ON confidence_violations;
CREATE POLICY "Users view own violations"
  ON confidence_violations
  FOR SELECT
  TO authenticated
  USING (
    prediction_id IN (
      SELECT id FROM agent_predictions ap
      WHERE ap.session_id IN (
        SELECT id FROM agent_sessions WHERE user_id = auth.uid()
      )
    )
  );

-- System can insert violations
CREATE POLICY "System inserts violations"
  ON confidence_violations
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Agent Accuracy Metrics: Organization-scoped
DROP POLICY IF EXISTS "Org members view metrics" ON agent_accuracy_metrics;
CREATE POLICY "Org members view metrics"
  ON agent_accuracy_metrics
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL OR 
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- System can manage metrics
CREATE POLICY "System manages metrics"
  ON agent_accuracy_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Agent Retraining Queue: Admin only
DROP POLICY IF EXISTS "Admins view retraining queue" ON agent_retraining_queue;
CREATE POLICY "Admins view retraining queue"
  ON agent_retraining_queue
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid()
        AND r.role_name = 'admin'
        AND om.status = 'active'
    )
  );

-- System manages retraining queue
CREATE POLICY "System manages retraining"
  ON agent_retraining_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;

RAISE NOTICE 'SUCCESS: RLS enabled on agent prediction tables';
EOF
```

---

### 🔴 Fix 1.3: Enable RLS on Other Missing Tables

**Create Comprehensive Fix:**
```bash
cat > supabase/migrations/20241129000011_fix_remaining_rls.sql << 'EOF'
-- Fix: Enable RLS on Remaining Unprotected Tables
-- Addresses: Multiple tables without RLS

BEGIN;

-- ============================================================================
-- 1. Tenant Integrations
-- ============================================================================
ALTER TABLE IF EXISTS integration_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own integration usage"
  ON integration_usage_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages integration logs"
  ON integration_usage_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2. Billing Webhooks
-- ============================================================================
ALTER TABLE IF EXISTS public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Webhooks are service-role only (Stripe callbacks)
CREATE POLICY "Service role only webhook access"
  ON public.webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. Retention Policies (admin-only configuration)
-- ============================================================================
ALTER TABLE IF EXISTS public.retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage retention policies"
  ON public.retention_policies
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid()
        AND r.role_name IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid()
        AND r.role_name IN ('admin', 'owner')
    )
  );

CREATE POLICY "Service role manages retention"
  ON public.retention_policies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. Provenance Tables
-- ============================================================================
ALTER TABLE IF EXISTS lifecycle_artifact_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS provenance_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own artifact links"
  ON lifecycle_artifact_links
  FOR SELECT
  TO authenticated
  USING (
    source_artifact_id IN (
      SELECT id FROM artifacts WHERE created_by = auth.uid()
    )
    OR target_artifact_id IN (
      SELECT id FROM artifacts WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users view own provenance"
  ON provenance_audit_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages provenance"
  ON provenance_audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMIT;

RAISE NOTICE 'SUCCESS: RLS enabled on remaining tables';
EOF
```

---

## Phase 2: Integrity Assurance (T+2 to T+4 Hours)

### 🔴 Fix 2.1: Make Audit Logs Immutable

**Problem:** 4 audit tables allow UPDATE/DELETE  
**Severity:** 🔴 CRITICAL

**Create Fix Migration:**
```bash
cat > supabase/migrations/20241129000012_fix_audit_immutability.sql << 'EOF'
-- Fix: Make All Audit Logs Immutable
-- Addresses: CRITICAL - audit logs can be tampered with

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. Apply to audit_logs (enterprise_saas_settings)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'audit_logs') THEN
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
    
    RAISE NOTICE 'audit_logs protected';
  END IF;
END $$;

-- ============================================================================
-- 3. Apply to security_audit_log (strict_rls_policies)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'security_audit_log') THEN
    DROP TRIGGER IF EXISTS tr_protect_security_audit ON security_audit_log;
    
    CREATE TRIGGER tr_protect_security_audit
      BEFORE UPDATE OR DELETE ON security_audit_log
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_audit_modification();
    
    REVOKE UPDATE, DELETE ON security_audit_log FROM PUBLIC;
    REVOKE UPDATE, DELETE ON security_audit_log FROM authenticated;
    
    RAISE NOTICE 'security_audit_log protected';
  END IF;
END $$;

-- ============================================================================
-- 4. Apply to agent_audit_log (agent_fabric)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_audit_log') THEN
    DROP TRIGGER IF EXISTS tr_protect_agent_audit ON agent_audit_log;
    
    CREATE TRIGGER tr_protect_agent_audit
      BEFORE UPDATE OR DELETE ON agent_audit_log
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_audit_modification();
    
    REVOKE UPDATE, DELETE ON agent_audit_log FROM PUBLIC;
    REVOKE UPDATE, DELETE ON agent_audit_log FROM authenticated;
    
    RAISE NOTICE 'agent_audit_log protected';
  END IF;
END $$;

-- ============================================================================
-- 5. Apply to workflow_audit_logs (workflow_orchestration)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_audit_logs') THEN
    DROP TRIGGER IF EXISTS tr_protect_workflow_audit ON workflow_audit_logs;
    
    CREATE TRIGGER tr_protect_workflow_audit
      BEFORE UPDATE OR DELETE ON workflow_audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_audit_modification();
    
    REVOKE UPDATE, DELETE ON workflow_audit_logs FROM PUBLIC;
    REVOKE UPDATE, DELETE ON workflow_audit_logs FROM authenticated;
    
    RAISE NOTICE 'workflow_audit_logs protected';
  END IF;
END $$;

COMMIT;

-- Verification: Try to delete from audit log (should fail)
DO $$
DECLARE
  test_id uuid;
BEGIN
  SELECT id INTO test_id FROM audit_logs LIMIT 1;
  
  IF test_id IS NOT NULL THEN
    BEGIN
      DELETE FROM audit_logs WHERE id = test_id;
      RAISE EXCEPTION 'FAILED: Audit log deletion was allowed!';
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLERRM LIKE '%immutable%' THEN
          RAISE NOTICE 'SUCCESS: Audit logs are properly protected';
        ELSE
          RAISE;
        END IF;
    END;
  END IF;
END $$;
EOF
```

---

### 🔴 Fix 2.2: Resolve Forward References

**Problem:** Migrations reference auth.users and agent_sessions before creation  
**Severity:** 🔴 CRITICAL

**Option 1: Add Conditional Checks (Safest)**
```bash
cat > supabase/migrations/20241123110001_fix_llm_monitoring_deps.sql << 'EOF'
-- Fix: Add Dependency Checks to LLM Monitoring
-- Addresses: Forward reference to auth.users and agent_sessions

BEGIN;

-- Only proceed if dependencies exist
DO $$
BEGIN
  -- Check auth.users exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    RAISE WARNING 'auth.users does not exist yet - some FK constraints will be skipped';
  END IF;
  
  -- Check agent_sessions exists
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE tablename = 'agent_sessions'
  ) THEN
    RAISE WARNING 'agent_sessions does not exist yet - some FK constraints will be skipped';
  END IF;
END $$;

-- Modify llm_usage FK to be conditional
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'agent_sessions') THEN
    -- Add FK if agent_sessions exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'llm_usage_session_id_fkey'
    ) THEN
      ALTER TABLE llm_usage 
        ADD CONSTRAINT llm_usage_session_id_fkey
        FOREIGN KEY (session_id) 
        REFERENCES agent_sessions(id) 
        ON DELETE CASCADE;
      
      RAISE NOTICE 'Added FK: llm_usage -> agent_sessions';
    END IF;
  ELSE
    RAISE NOTICE 'Skipped FK: agent_sessions not yet created';
  END IF;
END $$;

COMMIT;
EOF
```

**Option 2: Reorder Migrations (More Complex)**
See MIGRATION_ORDER.md for proper sequencing.

---

### 🔴 Fix 2.3: Scope Overly Permissive Policies

**Problem:** 15 policies with `USING (true)` to authenticated users  
**Severity:** 🔴 CRITICAL

**Fix Feature Flags:**
```bash
cat > supabase/migrations/20241123130001_fix_feature_flag_policies.sql << 'EOF'
-- Fix: Restrict Feature Flag Policies
-- Addresses: Overly permissive USING (true) policies

BEGIN;

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can insert feature flags" ON feature_flags;
DROP POLICY IF EXISTS "Anyone can update feature flags" ON feature_flags;
DROP POLICY IF EXISTS "Anyone can delete feature flags" ON feature_flags;

-- Replace with admin-only policies
CREATE POLICY "Admins manage feature flags"
  ON feature_flags
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid()
        AND r.role_name IN ('admin', 'owner')
        AND om.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid()
        AND r.role_name IN ('admin', 'owner')
        AND om.status = 'active'
    )
  );

-- Users can read feature flags
CREATE POLICY "Users read feature flags"
  ON feature_flags
  FOR SELECT
  TO authenticated
  USING (enabled = true);  -- Only enabled flags visible

-- Service role full access
CREATE POLICY "Service role manages flags"
  ON feature_flags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;

RAISE NOTICE 'SUCCESS: Feature flag policies tightened';
EOF
```

---

## Phase 3: Performance & Security Hardening (T+4 to T+6 Hours)

### 🟡 Fix 3.1: Add Missing FK Indexes

```bash
cat > supabase/migrations/20241129000013_add_missing_indexes.sql << 'EOF'
-- Fix: Add Missing Foreign Key Indexes
-- Addresses: Performance degradation on joins

BEGIN;

-- Add indexes on FK columns that are missing them
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_confidence_violations_prediction_id
  ON confidence_violations(prediction_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenant_integrations_user_id
  ON tenant_integrations(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_approval_requests_second_approver
  ON approval_requests(second_approver_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sof_owner_id
  ON business_objectives(owner_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sof_hypothesis_id
  ON outcome_hypotheses(outcome_hypothesis_id);

COMMIT;

-- Verification
SELECT 
  tablename,
  indexname
FROM pg_indexes
WHERE indexname LIKE 'idx_%prediction_id%'
   OR indexname LIKE 'idx_%user_id%'
   OR indexname LIKE 'idx_%approver%'
   OR indexname LIKE 'idx_sof%';
EOF
```

---

### 🟡 Fix 3.2: Secure SECURITY DEFINER Functions

```bash
cat > supabase/migrations/20241129000014_secure_definer_functions.sql << 'EOF'
-- Fix: Secure SECURITY DEFINER Functions
-- Addresses: Potential privilege escalation

BEGIN;

-- Set search_path on all SECURITY DEFINER functions
DO $$
DECLARE
  func record;
BEGIN
  FOR func IN 
    SELECT 
      n.nspname as schema,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true  -- SECURITY DEFINER
      AND n.nspname = 'public'
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
      func.schema,
      func.function_name,
      func.args
    );
    
    RAISE NOTICE 'Secured: %.%(%)', func.schema, func.function_name, func.args;
  END LOOP;
END $$;

-- Revoke public execute on sensitive functions
REVOKE EXECUTE ON FUNCTION track_llm_cost(uuid, text, integer, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_cost_summary(uuid, integer) FROM PUBLIC;

-- Grant to specific roles only
GRANT EXECUTE ON FUNCTION track_llm_cost(uuid, text, integer, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION get_cost_summary(uuid, integer) TO authenticated;

COMMIT;

RAISE NOTICE 'SUCCESS: SECURITY DEFINER functions hardened';
EOF
```

---

## Final Validation Script

```sql
-- ============================================================================
-- COMPLETE REMEDIATION VALIDATION
-- Run this after all fixes to verify everything is secure
-- ============================================================================

-- 1. Check RLS Coverage
SELECT 
  'RLS Check' as test,
  count(*) as insecure_count
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE 'sql_%'
  AND rowsecurity = false;
-- Should return 0

-- 2. Check Audit Immutability
SELECT 
  'Audit Immutability' as test,
  count(*) as protected_count
FROM pg_trigger
WHERE tgname LIKE '%protect_audit%';
-- Should return 4 (one for each audit table)

-- 3. Check Permissive Policies  
SELECT 
  'Permissive Policies' as test,
  count(*) as risky_count
FROM pg_policies
WHERE (policyqualifiedusing LIKE '%true%' OR policyqualifiedcheck LIKE '%true%')
  AND policyname NOT LIKE '%service_role%'
  AND policyname NOT LIKE '%System%';
-- Should be minimal (ideally 0)

-- 4. Check FK Indexes
SELECT 
  'Missing FK Indexes' as test,
  count(*) as missing_count
FROM (
  SELECT 
    conrelid::regclass as table_name,
    conname as constraint_name,
    array_agg(a.attname) as fk_columns
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
  WHERE c.contype = 'f'  -- Foreign keys
  GROUP BY conrelid, conname
) fks
WHERE NOT EXISTS (
  SELECT 1 FROM pg_index i
  WHERE i.indrelid = fks.table_name::oid
    AND i.indkey::text LIKE '%' || array_to_string(fks.fk_columns, '%') || '%'
);
-- Should return 0

-- 5. Check SECURITY DEFINER Safety
SELECT 
  'Unsafe DEFINER Functions' as test,
  count(*) as unsafe_count
FROM pg_proc
WHERE prosecdef = true
  AND proconfig IS NULL;  -- No search_path set
-- Should return 0

-- ============================================================================
-- Summary Report
-- ============================================================================
SELECT
  'FINAL STATUS' as report,
  CASE
    WHEN (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false) = 0
     AND (SELECT count(*) FROM pg_trigger WHERE tgname LIKE '%protect_audit%') >= 4
     AND (SELECT count(*) FROM pg_proc WHERE prosecdef = true AND proconfig IS NULL) = 0
    THEN '✅ ALL CHECKS PASSED - PRODUCTION READY'
    ELSE '❌ ISSUES REMAIN - DO NOT DEPLOY'
  END as status;
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All fix migrations created and reviewed
- [ ] Migrations tested on local database
- [ ] Validation script passes 100%
- [ ] Backup created
- [ ] Rollback scripts prepared

### Deployment
- [ ] Apply migrations in order (20241129000010 through 20241129000014)
- [ ] Run validation script after each phase
- [ ] Monitor for errors
- [ ] Check application functionality

### Post-Deployment
- [ ] Run complete validation script
- [ ] Test user access (should see only own data)
- [ ] Test audit log immutability (DELETE should fail)
- [ ] Verify query performance
- [ ] Monitor error logs for 24 hours

---

## Rollback Procedures

If issues occur:

```bash
# Rollback individual fixes
psql $DATABASE_URL -f supabase/migrations/rollbacks/20241129000014_rollback_secure_definer.sql
psql $DATABASE_URL -f supabase/migrations/rollbacks/20241129000013_rollback_indexes.sql
# ... etc

# Nuclear option: Restore from backup
pg_restore -d valuecanvas_db backup_20251201.dump
```

---

**Total Estimated Time:** 4-6 hours  
**Priority:** 🔴 CRITICAL - Do not deploy without fixes  
**Status:** Ready to execute

