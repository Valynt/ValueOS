-- Rollback: 20260330000000_approval_requests_column_reconciliation

SET search_path = public, pg_temp;

DROP INDEX IF EXISTS idx_approval_requests_tenant_status;
DROP INDEX IF EXISTS idx_approval_requests_requester_created;

DROP POLICY IF EXISTS approval_requests_tenant_select ON public.approval_requests;
DROP POLICY IF EXISTS approval_requests_tenant_insert ON public.approval_requests;
DROP POLICY IF EXISTS approval_requests_tenant_update ON public.approval_requests;

-- Restore the original (fragile) current_setting-based policy.
CREATE POLICY approval_requests_tenant_isolation ON public.approval_requests
  USING (organization_id = (current_setting('app.current_organization_id', true))::uuid);

ALTER TABLE public.approval_requests
  DROP COLUMN IF EXISTS requester_id;

ALTER TABLE public.approval_requests
  DROP COLUMN IF EXISTS tenant_id;
