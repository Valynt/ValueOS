-- ============================================================================
-- Replace legacy tenant isolation policies with JWT-claim enforced helpers
-- ============================================================================

-- Drop legacy policies that rely on app.current_tenant_id or auth.jwt()->>'org_id'.
DROP POLICY IF EXISTS secret_audit_logs_tenant_isolation ON public.secret_audit_logs;
DROP POLICY IF EXISTS secret_audit_logs_tenant_isolation ON public.secret_audit_logs_legacy;

DROP POLICY IF EXISTS llm_gating_policies_tenant_isolation ON public.llm_gating_policies;
DROP POLICY IF EXISTS llm_usage_tenant_isolation ON public.llm_usage;

DROP POLICY IF EXISTS "Tenants can view own usage" ON public.llm_usage;
DROP POLICY IF EXISTS "Tenants can insert own usage" ON public.llm_usage;
DROP POLICY IF EXISTS "Tenants can view own budget" ON public.llm_gating_policies;
DROP POLICY IF EXISTS "Tenants can update own budget" ON public.llm_gating_policies;

DROP POLICY IF EXISTS "Strict tenant isolation - usage logs" ON public.llm_usage;
DROP POLICY IF EXISTS "Strict tenant isolation - budgets" ON public.llm_gating_policies;

-- ============================================================================
-- Replacement restrictive policies using security.current_tenant_id()
-- ============================================================================

CREATE POLICY secret_audit_logs_tenant_isolation ON public.secret_audit_logs
  AS RESTRICTIVE
  FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY secret_audit_logs_tenant_isolation ON public.secret_audit_logs_legacy
  AS RESTRICTIVE
  FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY llm_gating_policies_tenant_isolation ON public.llm_gating_policies
  AS RESTRICTIVE
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR security.user_has_tenant_access(tenant_id)
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR security.user_has_tenant_access(tenant_id)
  );

CREATE POLICY llm_usage_tenant_isolation ON public.llm_usage
  AS RESTRICTIVE
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR security.user_has_tenant_access(tenant_id)
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR security.user_has_tenant_access(tenant_id)
  );

CREATE POLICY "Tenants can view own usage" ON public.llm_usage
  AS RESTRICTIVE
  FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenants can insert own usage" ON public.llm_usage
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenants can view own budget" ON public.llm_gating_policies
  AS RESTRICTIVE
  FOR SELECT
  USING (security.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenants can update own budget" ON public.llm_gating_policies
  AS RESTRICTIVE
  FOR UPDATE
  USING (security.user_has_tenant_access(tenant_id))
  WITH CHECK (security.user_has_tenant_access(tenant_id));

CREATE POLICY "Strict tenant isolation - usage logs" ON public.llm_usage
  AS RESTRICTIVE
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR security.user_has_tenant_access(tenant_id)
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR security.user_has_tenant_access(tenant_id)
  );

CREATE POLICY "Strict tenant isolation - budgets" ON public.llm_gating_policies
  AS RESTRICTIVE
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR security.user_has_tenant_access(tenant_id)
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR security.user_has_tenant_access(tenant_id)
  );

-- ============================================================================
-- Verification: ensure no legacy tenant claim usage remains on key tables
-- ============================================================================
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)
    INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'secret_audit_logs',
      'secret_audit_logs_legacy',
      'llm_usage',
      'llm_gating_policies'
    )
    AND (
      pg_get_expr(polqual, polrelid) ILIKE '%app.current_tenant_id%'
      OR pg_get_expr(polqual, polrelid) ILIKE '%org_id%'
      OR pg_get_expr(polwithcheck, polrelid) ILIKE '%app.current_tenant_id%'
      OR pg_get_expr(polwithcheck, polrelid) ILIKE '%org_id%'
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Legacy tenant isolation policies still reference app.current_tenant_id or org_id in public schema.';
  END IF;
END $$;
