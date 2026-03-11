-- Rollback: drop the corrected indexes.
-- The original broken indexes are not restored — they reference non-existent
-- columns and would fail to apply.

SET search_path = public, pg_temp;

DROP INDEX IF EXISTS public.idx_approval_requests_org_status;
DROP INDEX IF EXISTS public.idx_approval_requests_requested_by_created;
