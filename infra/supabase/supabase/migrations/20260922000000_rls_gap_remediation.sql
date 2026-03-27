-- RLS gap remediation: enable RLS and add policies on all public tables that
-- were missing coverage after the 20260917 remediation pass.
--
-- Audit basis: docs/db/schema_snapshot.sql cross-referenced against all active
-- migrations. 16 tables were identified without ENABLE ROW LEVEL SECURITY.
-- webhook_events was already fixed in 20260917; the remaining 15 are addressed here.
--
-- Policy classification per table:
--   tenant_scoped  — carries tenant_id; authenticated users see only their tenant's rows
--   service_only   — no tenant_id or system-internal; only service_role may access
--   own_row        — user identity table; authenticated users see only their own row

BEGIN;

-- Scoped to this transaction only; rolled back automatically on failure.
SET LOCAL search_path = public, pg_temp;

-- ============================================================================
-- 1. llm_calls — service_role only
--    No tenant_id column. Written exclusively by backend workers via
--    service_role. Authenticated users must not read raw LLM call records.
-- ============================================================================

ALTER TABLE public.llm_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS llm_calls_service_role ON public.llm_calls;
CREATE POLICY llm_calls_service_role ON public.llm_calls
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.llm_calls FROM anon, authenticated;
GRANT ALL ON public.llm_calls TO service_role;

-- ============================================================================
-- 2. login_attempts — service_role only
--    Security audit table. No tenant_id. Written by auth middleware, read by
--    security monitoring workers. No direct authenticated access.
-- ============================================================================

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS login_attempts_service_role ON public.login_attempts;
CREATE POLICY login_attempts_service_role ON public.login_attempts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.login_attempts FROM anon, authenticated;
GRANT ALL ON public.login_attempts TO service_role;

-- ============================================================================
-- 3. integration_usage_log — service_role only
--    No tenant_id column. Internal usage telemetry written by integration
--    workers. Not exposed to authenticated users directly.
-- ============================================================================

ALTER TABLE public.integration_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_usage_log_service_role ON public.integration_usage_log;
CREATE POLICY integration_usage_log_service_role ON public.integration_usage_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.integration_usage_log FROM anon, authenticated;
GRANT ALL ON public.integration_usage_log TO service_role;

-- ============================================================================
-- 4. retention_policies — service_role only
--    System configuration table. No tenant_id. Managed by ops/cron workers.
-- ============================================================================

ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS retention_policies_service_role ON public.retention_policies;
CREATE POLICY retention_policies_service_role ON public.retention_policies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.retention_policies FROM anon, authenticated;
GRANT ALL ON public.retention_policies TO service_role;

-- ============================================================================
-- 5. memory_provenance — service_role only
--    Internal memory system provenance chain. No tenant_id column.
--    Read/written by memory workers only.
-- ============================================================================

ALTER TABLE public.memory_provenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS memory_provenance_service_role ON public.memory_provenance;
CREATE POLICY memory_provenance_service_role ON public.memory_provenance
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.memory_provenance FROM anon, authenticated;
GRANT ALL ON public.memory_provenance TO service_role;

-- ============================================================================
-- 6. memory_benchmark_slices — service_role only
--    Benchmark dataset slices. No tenant_id. Internal evaluation tooling.
-- ============================================================================

ALTER TABLE public.memory_benchmark_slices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS memory_benchmark_slices_service_role ON public.memory_benchmark_slices;
CREATE POLICY memory_benchmark_slices_service_role ON public.memory_benchmark_slices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.memory_benchmark_slices FROM anon, authenticated;
GRANT ALL ON public.memory_benchmark_slices TO service_role;

-- ============================================================================
-- 7. memory_benchmark_run_locks — service_role only
--    Distributed lock table for benchmark runs. No tenant_id.
-- ============================================================================

ALTER TABLE public.memory_benchmark_run_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS memory_benchmark_run_locks_service_role ON public.memory_benchmark_run_locks;
CREATE POLICY memory_benchmark_run_locks_service_role ON public.memory_benchmark_run_locks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.memory_benchmark_run_locks FROM anon, authenticated;
GRANT ALL ON public.memory_benchmark_run_locks TO service_role;

-- ============================================================================
-- 8. value_prediction_accuracy — service_role only
--    Prediction accuracy tracking. No tenant_id column. Written by
--    realization workers; not directly queryable by authenticated users.
-- ============================================================================

ALTER TABLE public.value_prediction_accuracy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS value_prediction_accuracy_service_role ON public.value_prediction_accuracy;
CREATE POLICY value_prediction_accuracy_service_role ON public.value_prediction_accuracy
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.value_prediction_accuracy FROM anon, authenticated;
GRANT ALL ON public.value_prediction_accuracy TO service_role;

-- ============================================================================
-- 9. approval_requests_archive — tenant-scoped
--    Archive of approval requests. Has tenant_id. Authenticated users may
--    read their own tenant's archived records; service_role manages writes.
-- ============================================================================

ALTER TABLE public.approval_requests_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS approval_requests_archive_tenant_select ON public.approval_requests_archive;
CREATE POLICY approval_requests_archive_tenant_select ON public.approval_requests_archive
  FOR SELECT TO authenticated
  USING (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS approval_requests_archive_service_role ON public.approval_requests_archive;
CREATE POLICY approval_requests_archive_service_role ON public.approval_requests_archive
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.approval_requests_archive TO authenticated;
GRANT ALL ON public.approval_requests_archive TO service_role;
REVOKE ALL ON public.approval_requests_archive FROM anon;

-- ============================================================================
-- 10. approvals_archive — tenant-scoped
--     Archive of approval decisions. Has tenant_id.
-- ============================================================================

ALTER TABLE public.approvals_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS approvals_archive_tenant_select ON public.approvals_archive;
CREATE POLICY approvals_archive_tenant_select ON public.approvals_archive
  FOR SELECT TO authenticated
  USING (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS approvals_archive_service_role ON public.approvals_archive;
CREATE POLICY approvals_archive_service_role ON public.approvals_archive
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.approvals_archive TO authenticated;
GRANT ALL ON public.approvals_archive TO service_role;
REVOKE ALL ON public.approvals_archive FROM anon;

-- ============================================================================
-- 11. memberships — tenant-scoped
--     Lightweight tenant membership mirror. Has tenant_id.
--     Users may read their own tenant's membership records.
-- ============================================================================

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS memberships_tenant_select ON public.memberships;
CREATE POLICY memberships_tenant_select ON public.memberships
  FOR SELECT TO authenticated
  USING (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS memberships_service_role ON public.memberships;
CREATE POLICY memberships_service_role ON public.memberships
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
REVOKE ALL ON public.memberships FROM anon;

-- ============================================================================
-- 12. secret_audit_logs_2024 / _2025 / _2026 / _default — service_role only
--     Partition children of secret_audit_logs. Have tenant_id but are
--     internal audit records; authenticated users access via the parent
--     table's policies, not directly. Service_role manages all writes.
-- ============================================================================

ALTER TABLE public.secret_audit_logs_2024 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secret_audit_logs_2025 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secret_audit_logs_2026 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secret_audit_logs_default ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secret_audit_logs_2024_service_role ON public.secret_audit_logs_2024;
DROP POLICY IF EXISTS secret_audit_logs_2025_service_role ON public.secret_audit_logs_2025;
DROP POLICY IF EXISTS secret_audit_logs_2026_service_role ON public.secret_audit_logs_2026;
DROP POLICY IF EXISTS secret_audit_logs_default_service_role ON public.secret_audit_logs_default;

CREATE POLICY secret_audit_logs_2024_service_role ON public.secret_audit_logs_2024
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY secret_audit_logs_2025_service_role ON public.secret_audit_logs_2025
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY secret_audit_logs_2026_service_role ON public.secret_audit_logs_2026
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY secret_audit_logs_default_service_role ON public.secret_audit_logs_default
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.secret_audit_logs_2024 FROM anon, authenticated;
REVOKE ALL ON public.secret_audit_logs_2025 FROM anon, authenticated;
REVOKE ALL ON public.secret_audit_logs_2026 FROM anon, authenticated;
REVOKE ALL ON public.secret_audit_logs_default FROM anon, authenticated;
GRANT ALL ON public.secret_audit_logs_2024 TO service_role;
GRANT ALL ON public.secret_audit_logs_2025 TO service_role;
GRANT ALL ON public.secret_audit_logs_2026 TO service_role;
GRANT ALL ON public.secret_audit_logs_default TO service_role;

-- ============================================================================
-- 13. users (public.users) — own-row access
--     App-owned user mirror table (distinct from auth.users). No tenant_id;
--     scoped by user identity. Each authenticated user may read/update only
--     their own row. Service_role manages provisioning.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
  ) THEN
    -- Ensure RLS is enabled (the snapshot has ALTER TABLE IF EXISTS ... ENABLE ROW
    -- LEVEL SECURITY but no policies were ever created for this table).
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS users_own_row_select ON public.users;
    DROP POLICY IF EXISTS users_own_row_update ON public.users;
    DROP POLICY IF EXISTS users_service_role ON public.users;

    CREATE POLICY users_own_row_select ON public.users
      FOR SELECT TO authenticated
      USING (id = auth.uid()::text);

    CREATE POLICY users_own_row_update ON public.users
      FOR UPDATE TO authenticated
      USING (id = auth.uid()::text)
      WITH CHECK (id = auth.uid()::text);

    CREATE POLICY users_service_role ON public.users
      FOR ALL TO service_role USING (true) WITH CHECK (true);

    GRANT SELECT, UPDATE ON public.users TO authenticated;
    GRANT ALL ON public.users TO service_role;
    REVOKE ALL ON public.users FROM anon;
  END IF;
END
$$;

COMMIT;
