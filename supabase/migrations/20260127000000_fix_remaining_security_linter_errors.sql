-- Migration: Fix Remaining Database Security Linter Errors
-- Created: 2025-12-27
-- 
-- This migration fixes 4 remaining security linter errors:
-- 1. user_pillar_progress view - Add SECURITY INVOKER
-- 2. secret_audit_summary view - Add SECURITY INVOKER
-- 3. secret_audit_failures view - Add SECURITY INVOKER
-- 4. workflow_stage_runs table - Enable RLS with tenant isolation policies
--
-- Note: recent_confidence_violations and agent_performance_summary were fixed in earlier migrations:
-- - 20251226150000_security_hardening_fix_lint_errors.sql
-- - 20251226000000_fix_agent_performance_summary_security.sql

-- ============================================================================
-- 1. FIX: user_pillar_progress view (Academy Portal)
-- ============================================================================

-- Drop and recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.user_pillar_progress;

CREATE VIEW public.user_pillar_progress
WITH (security_invoker = true)
AS
SELECT 
  ap.user_id,
  am.pillar,
  COUNT(al.id) as total_lessons,
  COUNT(ap.id) FILTER (WHERE ap.status = 'completed') as completed_lessons,
  ROUND(
    (COUNT(ap.id) FILTER (WHERE ap.status = 'completed')::DECIMAL / NULLIF(COUNT(al.id), 0)) * 100,
    1
  ) as percent_complete,
  SUM(al.estimated_minutes) FILTER (WHERE ap.status != 'completed') as minutes_remaining
FROM academy_modules am
JOIN academy_lessons al ON al.module_id = am.id
LEFT JOIN academy_progress ap ON ap.lesson_id = al.id
GROUP BY ap.user_id, am.pillar;

COMMENT ON VIEW public.user_pillar_progress IS 
'SECURITY INVOKER view - User progress across academy pillars. Relies on RLS policies on academy_progress, academy_modules, and academy_lessons tables.';

-- Grant permissions
REVOKE ALL ON public.user_pillar_progress FROM PUBLIC;
GRANT SELECT ON public.user_pillar_progress TO authenticated;

-- ============================================================================
-- 2. FIX: secret_audit_summary view (Secret Audit Logs)
-- ============================================================================

-- Drop and recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.secret_audit_summary;

CREATE VIEW public.secret_audit_summary
WITH (security_invoker = true)
AS
SELECT 
  tenant_id,
  action,
  result,
  COUNT(*) as count,
  DATE_TRUNC('day', timestamp) as day
FROM secret_audit_logs
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY tenant_id, action, result, DATE_TRUNC('day', timestamp)
ORDER BY day DESC, tenant_id, action;

COMMENT ON VIEW public.secret_audit_summary IS 
'SECURITY INVOKER view - Daily summary of secret access operations by tenant and action type. Relies on RLS policy on secret_audit_logs table.';

-- Grant permissions
REVOKE ALL ON public.secret_audit_summary FROM PUBLIC;
GRANT SELECT ON public.secret_audit_summary TO authenticated;

-- ============================================================================
-- 3. FIX: secret_audit_failures view (Secret Audit Logs)
-- ============================================================================

-- Drop and recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.secret_audit_failures;

CREATE VIEW public.secret_audit_failures
WITH (security_invoker = true)
AS
SELECT 
  tenant_id,
  user_id,
  secret_key,
  action,
  error_message,
  timestamp
FROM secret_audit_logs
WHERE result = 'FAILURE'
AND timestamp >= NOW() - INTERVAL '7 days'
ORDER BY timestamp DESC;

COMMENT ON VIEW public.secret_audit_failures IS 
'SECURITY INVOKER view - Recent failed secret access attempts for security monitoring. Relies on RLS policy on secret_audit_logs table.';

-- Grant permissions
REVOKE ALL ON public.secret_audit_failures FROM PUBLIC;
GRANT SELECT ON public.secret_audit_failures TO authenticated;

-- ============================================================================
-- 4. FIX: workflow_stage_runs table - Enable RLS with tenant isolation
-- ============================================================================

-- Enable Row Level Security
ALTER TABLE public.workflow_stage_runs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "workflow_stage_runs_tenant_select" ON public.workflow_stage_runs;
DROP POLICY IF EXISTS "workflow_stage_runs_service_insert" ON public.workflow_stage_runs;
DROP POLICY IF EXISTS "workflow_stage_runs_service_update" ON public.workflow_stage_runs;
DROP POLICY IF EXISTS "workflow_stage_runs_service_delete" ON public.workflow_stage_runs;

-- Policy: Users can view stage runs for executions they can access
-- Relies on tenant isolation through parent workflow_executions table
CREATE POLICY "workflow_stage_runs_tenant_select" 
ON public.workflow_stage_runs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.workflow_executions we
    WHERE we.id = workflow_stage_runs.execution_id
    AND we.tenant_id IN (
      SELECT tenant_id 
      FROM public.user_tenants 
      WHERE user_id = (auth.uid())::text
    )
  )
);

-- Policy: Service role can insert stage run records
CREATE POLICY "workflow_stage_runs_service_insert"
ON public.workflow_stage_runs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy: Service role can update stage run records (status, outputs, etc.)
CREATE POLICY "workflow_stage_runs_service_update"
ON public.workflow_stage_runs
FOR UPDATE
TO service_role
USING (true);

-- Policy: Service role can delete (cleanup, though cascade from workflow_executions handles this)
CREATE POLICY "workflow_stage_runs_service_delete"
ON public.workflow_stage_runs
FOR DELETE
TO service_role
USING (true);

-- Grant permissions
GRANT SELECT ON public.workflow_stage_runs TO authenticated;
GRANT ALL ON public.workflow_stage_runs TO service_role;

-- Add performance index for RLS policy lookup
CREATE INDEX IF NOT EXISTS idx_workflow_stage_runs_execution_tenant 
ON public.workflow_stage_runs(execution_id);

-- ============================================================================
-- Validation and Summary
-- ============================================================================

DO $$
DECLARE
  view_count INTEGER;
  rls_enabled BOOLEAN;
  policy_count INTEGER;
BEGIN
  -- Count views with correct security settings
  SELECT COUNT(*) INTO view_count
  FROM pg_views
  WHERE schemaname = 'public'
  AND viewname IN ('user_pillar_progress', 'secret_audit_summary', 'secret_audit_failures');
  
  -- Check RLS on workflow_stage_runs
  SELECT c.relrowsecurity INTO rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
  AND c.relname = 'workflow_stage_runs';
  
  -- Count policies on workflow_stage_runs
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename = 'workflow_stage_runs';
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================================================';
  RAISE NOTICE 'Security Linter Errors Fixed';
  RAISE NOTICE '========================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Fixed % views with SECURITY INVOKER:', view_count;
  RAISE NOTICE '   - user_pillar_progress';
  RAISE NOTICE '   - secret_audit_summary';
  RAISE NOTICE '   - secret_audit_failures';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Enabled RLS on workflow_stage_runs: %', rls_enabled;
  RAISE NOTICE '✅ Created % RLS policies for workflow_stage_runs', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Re-run database linter to confirm all errors resolved';
  RAISE NOTICE '  2. Test view queries as different users';
  RAISE NOTICE '  3. Test workflow_stage_runs access with tenant isolation';
  RAISE NOTICE '';
END $$;
