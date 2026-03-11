-- Rollback: 20260401030000_tenant_deletion_columns.sql

SET search_path = public, pg_temp;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_status_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_status_check
    CHECK (status = ANY (ARRAY['active', 'suspended', 'deleted']));

ALTER TABLE public.tenants
  DROP COLUMN IF EXISTS deletion_requested_at,
  DROP COLUMN IF EXISTS deletion_requested_by,
  DROP COLUMN IF EXISTS deletion_scheduled_at,
  DROP COLUMN IF EXISTS deletion_reason,
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS data_exported_at;
