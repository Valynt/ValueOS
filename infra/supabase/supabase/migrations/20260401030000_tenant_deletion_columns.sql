-- Tenant deletion lifecycle columns.
--
-- Adds soft-delete state to the tenants table so the deletion workflow can
-- track which phase a tenant is in (active → pending_deletion → deleted).
-- The hard-delete job filters on deletion_scheduled_at to find tenants whose
-- soft-delete period has elapsed.

SET search_path = public, pg_temp;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS deletion_requested_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_requested_by  text,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_reason        text,
  ADD COLUMN IF NOT EXISTS deleted_at             timestamptz,
  ADD COLUMN IF NOT EXISTS data_exported_at       timestamptz;

-- Update the status check to include pending_deletion
ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_status_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_status_check
    CHECK (status = ANY (ARRAY[
      'active', 'suspended', 'pending_deletion', 'deleted'
    ]));

-- Index for the hard-delete job: find tenants whose soft-delete window has elapsed
CREATE INDEX IF NOT EXISTS idx_tenants_deletion_scheduled
  ON public.tenants (deletion_scheduled_at)
  WHERE deletion_scheduled_at IS NOT NULL AND deleted_at IS NULL;
