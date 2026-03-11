-- Fix approval_requests indexes from Sprint 14.
--
-- The original migration (20260324000000_performance_indexes.sql) referenced
-- columns tenant_id and requester_id, which do not exist on approval_requests.
-- The canonical column names are organization_id and requested_by.
--
-- This migration drops the non-existent-column indexes (IF EXISTS is safe
-- because they never applied successfully) and creates correct replacements.
-- New code must use organization_id and requested_by exclusively — the alias
-- columns are not a second canonical path.

SET search_path = public, pg_temp;

-- Drop the incorrectly-named indexes if they somehow exist.
DROP INDEX IF EXISTS public.idx_approval_requests_tenant_status;
DROP INDEX IF EXISTS public.idx_approval_requests_requester_created;

-- Correct indexes using the canonical column names.
CREATE INDEX IF NOT EXISTS idx_approval_requests_org_status
    ON public.approval_requests (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by_created
    ON public.approval_requests (requested_by, created_at DESC);
