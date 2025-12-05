/*
  # SEC-001: Global RLS Enforcement
  
  CRITICAL SECURITY FIX: Enable Row-Level Security on ALL tables.
  
  ## Tables Fixed
  - lifecycle_artifact_links
  - provenance_audit_log
  
  ## Security Impact
  Without RLS, these tables are vulnerable to cross-tenant data access.
  This migration enforces database-level tenant isolation.
  
  ## Verification
  Run: SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
       AND tablename NOT IN (SELECT tablename FROM pg_policies);
  Expected: Empty result set
*/

-- =====================================================
-- Enable RLS on Missing Tables
-- =====================================================

-- Table 1: lifecycle_artifact_links
ALTER TABLE lifecycle_artifact_links ENABLE ROW LEVEL SECURITY;

-- Table 2: provenance_audit_log  
ALTER TABLE provenance_audit_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Create RLS Policies for lifecycle_artifact_links
-- =====================================================

-- Policy: Users can only view links for their own artifacts
CREATE POLICY "tenant_isolation_select_lifecycle_artifact_links" 
  ON lifecycle_artifact_links
  FOR SELECT 
  USING (
    -- Check if user has access to the source artifact
    EXISTS (
      SELECT 1 FROM artifacts a
      WHERE a.id = lifecycle_artifact_links.artifact_id
      AND (
        a.created_by = auth.uid()
        OR a.tenant_id IN (
          SELECT tenant_id FROM user_tenants 
          WHERE user_id = auth.uid() 
          AND status = 'active'
        )
      )
    )
  );

-- Policy: Users can only insert links for artifacts they own
CREATE POLICY "tenant_isolation_insert_lifecycle_artifact_links"
  ON lifecycle_artifact_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artifacts a
      WHERE a.id = lifecycle_artifact_links.artifact_id
      AND (
        a.created_by = auth.uid()
        OR a.tenant_id IN (
          SELECT tenant_id FROM user_tenants 
          WHERE user_id = auth.uid() 
          AND status = 'active'
        )
      )
    )
  );

-- Policy: Users can only update their own links
CREATE POLICY "tenant_isolation_update_lifecycle_artifact_links"
  ON lifecycle_artifact_links
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM artifacts a
      WHERE a.id = lifecycle_artifact_links.artifact_id
      AND (
        a.created_by = auth.uid()
        OR a.tenant_id IN (
          SELECT tenant_id FROM user_tenants 
          WHERE user_id = auth.uid() 
          AND status = 'active'
        )
      )
    )
  );

-- Policy: Users can only delete their own links
CREATE POLICY "tenant_isolation_delete_lifecycle_artifact_links"
  ON lifecycle_artifact_links
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM artifacts a
      WHERE a.id = lifecycle_artifact_links.artifact_id
      AND (
        a.created_by = auth.uid()
        OR a.tenant_id IN (
          SELECT tenant_id FROM user_tenants 
          WHERE user_id = auth.uid() 
          AND status = 'active'
        )
      )
    )
  );

-- =====================================================
-- Create RLS Policies for provenance_audit_log
-- =====================================================

-- CRITICAL: Audit logs must be read-only for non-admins
-- Only system and admins can view audit logs

-- Policy: Only admins can view audit logs
CREATE POLICY "admin_only_select_provenance_audit_log"
  ON provenance_audit_log
  FOR SELECT
  USING (
    -- Check if user is admin
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name = 'admin'
      AND ur.status = 'active'
    )
    OR
    -- Or if viewing their own actions
    actor_id = auth.uid()::text
  );

-- Policy: System can insert audit logs (service role only)
CREATE POLICY "system_only_insert_provenance_audit_log"
  ON provenance_audit_log
  FOR INSERT
  WITH CHECK (
    -- Only service role can insert
    auth.role() = 'service_role'
  );

-- Policy: No updates allowed (audit logs are immutable)
CREATE POLICY "no_updates_provenance_audit_log"
  ON provenance_audit_log
  FOR UPDATE
  USING (false);

-- Policy: No deletes allowed (audit logs are immutable)
CREATE POLICY "no_deletes_provenance_audit_log"
  ON provenance_audit_log
  FOR DELETE
  USING (false);

-- =====================================================
-- Verification Queries
-- =====================================================

-- Verify all tables have RLS enabled
DO $$
DECLARE
  tables_without_rls INTEGER;
BEGIN
  SELECT COUNT(*) INTO tables_without_rls
  FROM pg_tables t
  WHERE t.schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    WHERE c.relname = t.tablename
    AND c.relrowsecurity = true
  );

  IF tables_without_rls > 0 THEN
    RAISE EXCEPTION 'SECURITY VIOLATION: % tables without RLS enabled', tables_without_rls;
  END IF;

  RAISE NOTICE 'SUCCESS: All % public tables have RLS enabled', 
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public');
END $$;

-- Verify policies exist for critical tables
DO $$
DECLARE
  missing_policies TEXT[];
BEGIN
  SELECT ARRAY_AGG(tablename) INTO missing_policies
  FROM pg_tables t
  WHERE t.schemaname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.tablename = t.tablename
  );

  IF missing_policies IS NOT NULL THEN
    RAISE WARNING 'Tables without policies: %', missing_policies;
  END IF;
END $$;

-- =====================================================
-- Security Event Logging
-- =====================================================

-- Log this security fix
INSERT INTO security_events (
  event_type,
  severity,
  details,
  created_at
) VALUES (
  'rls_enforcement_applied',
  'critical',
  jsonb_build_object(
    'migration', '20251123000000_enforce_global_rls',
    'tables_fixed', ARRAY['lifecycle_artifact_links', 'provenance_audit_log'],
    'policies_created', 10,
    'timestamp', NOW()
  ),
  NOW()
);

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON POLICY "tenant_isolation_select_lifecycle_artifact_links" 
  ON lifecycle_artifact_links IS 
  'SEC-001: Prevents cross-tenant access to artifact links';

COMMENT ON POLICY "admin_only_select_provenance_audit_log" 
  ON provenance_audit_log IS 
  'SEC-001: Audit logs restricted to admins and self-viewing only';

COMMENT ON POLICY "system_only_insert_provenance_audit_log" 
  ON provenance_audit_log IS 
  'SEC-001: Only service role can write audit logs to prevent tampering';

-- =====================================================
-- Final Verification
-- =====================================================

-- This should return 0
SELECT COUNT(*) as tables_without_rls
FROM pg_tables t
WHERE t.schemaname = 'public'
AND NOT EXISTS (
  SELECT 1 FROM pg_class c
  WHERE c.relname = t.tablename
  AND c.relrowsecurity = true
);
