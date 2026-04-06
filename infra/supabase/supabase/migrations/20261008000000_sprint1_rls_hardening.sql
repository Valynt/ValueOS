-- RLS Final Launch Hardening
-- Status: Sprint 1.1 Implementation
-- Targets: Missing RLS on core tables, transition to organization_id standard,
-- and enforcing service_role-only access for internal telemetry.

BEGIN;

-- Safety timeouts: prevent long locks during launch deployment
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_temp;

-- ============================================================================
-- 1. Scenarios — tenant isolation
-- ============================================================================
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scenarios_tenant_isolation ON public.scenarios;
CREATE POLICY scenarios_tenant_isolation ON public.scenarios
  FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.user_tenants WHERE user_id = auth.uid() LIMIT 1))
  WITH CHECK (organization_id = (SELECT organization_id FROM public.user_tenants WHERE user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS scenarios_service_role ON public.scenarios;
CREATE POLICY scenarios_service_role ON public.scenarios
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. sensitivity_analysis — tenant isolation (standardized organization_id)
-- ============================================================================
ALTER TABLE public.sensitivity_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sensitivity_analysis_tenant_isolation ON public.sensitivity_analysis;
CREATE POLICY sensitivity_analysis_tenant_isolation ON public.sensitivity_analysis
  FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.user_tenants WHERE user_id = auth.uid() LIMIT 1))
  WITH CHECK (organization_id = (SELECT organization_id FROM public.user_tenants WHERE user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS sensitivity_analysis_service_role ON public.sensitivity_analysis;
CREATE POLICY sensitivity_analysis_service_role ON public.sensitivity_analysis
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. promise_baselines — tenant isolation
-- ============================================================================
ALTER TABLE public.promise_baselines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promise_baselines_tenant_isolation ON public.promise_baselines;
CREATE POLICY promise_baselines_tenant_isolation ON public.promise_baselines
  FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.user_tenants WHERE user_id = auth.uid() LIMIT 1))
  WITH CHECK (organization_id = (SELECT organization_id FROM public.user_tenants WHERE user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS promise_baselines_service_role ON public.promise_baselines;
CREATE POLICY promise_baselines_service_role ON public.promise_baselines
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 4. promise_kpi_targets — tenant isolation
-- ============================================================================
ALTER TABLE public.promise_kpi_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promise_kpi_targets_tenant_isolation ON public.promise_kpi_targets;
CREATE POLICY promise_kpi_targets_tenant_isolation ON public.promise_kpi_targets
  FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.user_tenants WHERE user_id = auth.uid() LIMIT 1))
  WITH CHECK (organization_id = (SELECT organization_id FROM public.user_tenants WHERE user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS promise_kpi_targets_service_role ON public.promise_kpi_targets;
CREATE POLICY promise_kpi_targets_service_role ON public.promise_kpi_targets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. Partition Children Cleanup (Historical)
--    PostgreSQL does not inherit RLS. We must ensure all existing partitions
--    explicitly have RLS enabled.
-- ============================================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT quote_ident(schemaname) || '.' || quote_ident(tablename) as full_name
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
          AND (tablename LIKE 'usage_ledger_p_%'
               OR tablename LIKE 'rated_ledger_p_%'
               OR tablename LIKE 'saga_transitions_p_%')
    ) LOOP
        EXECUTE 'ALTER TABLE ' || r.full_name || ' ENABLE ROW LEVEL SECURITY;';
    END LOOP;
END $$;

COMMIT;
