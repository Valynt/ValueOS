-- Fix: Enable RLS on Remaining Unprotected Tables
-- Addresses: Multiple tables without RLS protection
-- Tables: integration_usage_log, webhook_events, retention_policies, provenance tables

BEGIN;

-- ============================================================================
-- 1. Tenant Integrations
-- ============================================================================
ALTER TABLE IF EXISTS integration_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own integration usage" ON integration_usage_log;
CREATE POLICY "Users view own integration usage"
  ON integration_usage_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages integration logs" ON integration_usage_log;
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
DROP POLICY IF EXISTS "Service role only webhook access" ON public.webhook_events;
CREATE POLICY "Service role only webhook access"
  ON public.webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Block all other access
DROP POLICY IF EXISTS "Block public webhook access" ON public.webhook_events;
CREATE POLICY "Block public webhook access"
  ON public.webhook_events
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- ============================================================================
-- 3. Retention Policies (admin-only configuration)
-- ============================================================================
ALTER TABLE IF EXISTS public.retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage retention policies" ON public.retention_policies;
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

DROP POLICY IF EXISTS "Service role manages retention" ON public.retention_policies;
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

-- Artifact Links: Users view links for their artifacts
DROP POLICY IF EXISTS "Users view own artifact links" ON lifecycle_artifact_links;
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

DROP POLICY IF EXISTS "Service role manages artifact links" ON lifecycle_artifact_links;
CREATE POLICY "Service role manages artifact links"
  ON lifecycle_artifact_links
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Provenance Audit: Users view their own provenance
DROP POLICY IF EXISTS "Users view own provenance" ON provenance_audit_log;
CREATE POLICY "Users view own provenance"
  ON provenance_audit_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages provenance" ON provenance_audit_log;
CREATE POLICY "Service role manages provenance"
  ON provenance_audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Provenance is append-only
DROP POLICY IF EXISTS "Block provenance modifications" ON provenance_audit_log;
CREATE POLICY "Block provenance modifications"
  ON provenance_audit_log
  FOR UPDATE
  TO authenticated, service_role
  USING (false);

DROP POLICY IF EXISTS "Block provenance deletions" ON provenance_audit_log;
CREATE POLICY "Block provenance deletions"
  ON provenance_audit_log
  FOR DELETE
  TO authenticated, service_role
  USING (false);

COMMIT;

-- Verification
DO $$
DECLARE
  tables_to_check text[] := ARRAY[
    'integration_usage_log',
    'webhook_events', 
    'retention_policies',
    'lifecycle_artifact_links',
    'provenance_audit_log'
  ];
  tbl text;
  missing_rls text[] := '{}';
BEGIN
  FOREACH tbl IN ARRAY tables_to_check
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = tbl 
        AND rowsecurity = false
    ) THEN
      missing_rls := array_append(missing_rls, tbl);
    END IF;
  END LOOP;
  
  IF array_length(missing_rls, 1) > 0 THEN
    RAISE WARNING 'RLS not enabled on: %', array_to_string(missing_rls, ', ');
  ELSE
    RAISE NOTICE '✅ SUCCESS: RLS enabled on all remaining tables';
  END IF;
END $$;
