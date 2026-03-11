-- ============================================================================
-- approval_requests column reconciliation
--
-- PROBLEM
-- -------
-- The approval_requests DDL (20260302100000) uses:
--   organization_id uuid  — tenant scoping column
--   requested_by    uuid  — actor column
--
-- The backend API (approvals.ts) and RLS migrations (20260308000000) query:
--   tenant_id    — used in .eq('tenant_id', tenantId) and RLS policies
--   requester_id — used in .eq('requester_id', userId)
--
-- The Sprint 14 performance index also referenced tenant_id and requester_id,
-- both of which do not exist on the table.
--
-- FIX
-- ---
-- Add tenant_id and requester_id as generated columns that mirror
-- organization_id and requested_by respectively. This makes both names
-- valid without a data migration or application code change.
--
-- The canonical tenant-scoping column going forward is organization_id.
-- tenant_id is a read alias for backward compatibility with existing queries.
-- New code should use organization_id.
--
-- Rollback: 20260330000000_approval_requests_column_reconciliation.rollback.sql
-- ============================================================================

SET search_path = public, pg_temp;

-- Add tenant_id as a generated column mirroring organization_id.
-- STORED so it can be indexed.
ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS tenant_id uuid
    GENERATED ALWAYS AS (organization_id) STORED;

-- Add requester_id as a generated column mirroring requested_by.
ALTER TABLE public.approval_requests
  ADD COLUMN IF NOT EXISTS requester_id uuid
    GENERATED ALWAYS AS (requested_by) STORED;

-- Index tenant_id for the API query pattern .eq('tenant_id', ...) and RLS.
CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_status
  ON public.approval_requests (tenant_id, status, created_at DESC);

-- Index requester_id for the API query pattern .eq('requester_id', userId).
CREATE INDEX IF NOT EXISTS idx_approval_requests_requester_created
  ON public.approval_requests (requester_id, created_at DESC);

-- Replace the current_setting-based RLS policy (fragile, no auth.uid() check)
-- with security.user_has_tenant_access on organization_id.
DROP POLICY IF EXISTS approval_requests_tenant_isolation   ON public.approval_requests;
DROP POLICY IF EXISTS approval_requests_tenant_select      ON public.approval_requests;
DROP POLICY IF EXISTS approval_requests_tenant_insert      ON public.approval_requests;
DROP POLICY IF EXISTS approval_requests_tenant_update      ON public.approval_requests;

CREATE POLICY approval_requests_tenant_select ON public.approval_requests
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (security.user_has_tenant_access(organization_id));

CREATE POLICY approval_requests_tenant_insert ON public.approval_requests
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (security.user_has_tenant_access(organization_id));

CREATE POLICY approval_requests_tenant_update ON public.approval_requests
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING  (security.user_has_tenant_access(organization_id))
  WITH CHECK (security.user_has_tenant_access(organization_id));

-- service_role policy is already present from the DDL migration; keep it.
