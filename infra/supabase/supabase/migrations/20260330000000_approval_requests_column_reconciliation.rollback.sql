-- Rollback: 20260330000000_approval_requests_column_reconciliation
-- Removes columns and indexes added to approval_requests.

BEGIN;

DROP POLICY IF EXISTS approval_requests_tenant_update ON public.approval_requests;
DROP POLICY IF EXISTS approval_requests_tenant_insert ON public.approval_requests;
DROP POLICY IF EXISTS approval_requests_tenant_select ON public.approval_requests;

DROP INDEX IF EXISTS public.idx_approval_requests_requester_created;
DROP INDEX IF EXISTS public.idx_approval_requests_tenant_status;

ALTER TABLE public.approval_requests
  DROP COLUMN IF EXISTS requester_id,
  DROP COLUMN IF EXISTS tenant_id;

COMMIT;
