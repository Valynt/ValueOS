-- Verified archival retention for audit_logs and security_audit_log.
-- Adds immutable archive tables/metadata and write-once protections for
-- historical audit entries so cleanup only happens after verification.

SET search_path = public, pg_temp;

CREATE TABLE IF NOT EXISTS public.audit_retention_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL UNIQUE,
  source_table TEXT NOT NULL,
  archive_table TEXT NOT NULL,
  tenant_id UUID,
  retention_cutoff TEXT NOT NULL,
  archived_row_count INTEGER NOT NULL,
  source_checksum_sha256 TEXT NOT NULL,
  archive_checksum_sha256 TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('verified', 'verification_failed', 'delete_failed')),
  verified_at TIMESTAMPTZ,
  source_deleted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_retention_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_retention_batches_service_role ON public.audit_retention_batches;
CREATE POLICY audit_retention_batches_service_role ON public.audit_retention_batches
  AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.audit_retention_batches FROM authenticated, anon;
GRANT SELECT, INSERT ON public.audit_retention_batches TO service_role;

CREATE TABLE IF NOT EXISTS public.security_audit_log_archive (
  LIKE public.security_audit_log INCLUDING ALL
);

ALTER TABLE public.audit_logs_archive
  ADD COLUMN IF NOT EXISTS archive_batch_id UUID,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS archive_checksum_sha256 TEXT;

ALTER TABLE public.security_audit_log_archive
  ADD COLUMN IF NOT EXISTS archive_batch_id UUID,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS archive_checksum_sha256 TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_batch_id
  ON public.audit_logs_archive (archive_batch_id, archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_archive_batch_id
  ON public.security_audit_log_archive (archive_batch_id, archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_archive_tenant
  ON public.security_audit_log_archive (tenant_id, archived_at DESC);

ALTER TABLE public.security_audit_log_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_audit_log_archive_tenant_select ON public.security_audit_log_archive;
CREATE POLICY security_audit_log_archive_tenant_select ON public.security_audit_log_archive
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (security.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS security_audit_log_archive_service_role ON public.security_audit_log_archive;
CREATE POLICY security_audit_log_archive_service_role ON public.security_audit_log_archive
  AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.security_audit_log_archive TO authenticated;
REVOKE ALL ON public.audit_logs_archive FROM service_role;
GRANT SELECT, INSERT ON public.audit_logs_archive TO service_role;
REVOKE ALL ON public.security_audit_log_archive FROM service_role;
GRANT SELECT, INSERT ON public.security_audit_log_archive TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_historical_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Historical audit rows are immutable; % is not allowed on %', TG_OP, TG_TABLE_NAME;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_append_only_audit_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit rows are append-only; updates are not allowed on %', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_archive_immutable ON public.audit_logs_archive;
CREATE TRIGGER audit_logs_archive_immutable
BEFORE UPDATE OR DELETE ON public.audit_logs_archive
FOR EACH ROW EXECUTE FUNCTION public.prevent_historical_audit_mutation();

DROP TRIGGER IF EXISTS security_audit_log_archive_immutable ON public.security_audit_log_archive;
CREATE TRIGGER security_audit_log_archive_immutable
BEFORE UPDATE OR DELETE ON public.security_audit_log_archive
FOR EACH ROW EXECUTE FUNCTION public.prevent_historical_audit_mutation();

DROP TRIGGER IF EXISTS audit_logs_append_only_update ON public.audit_logs;
CREATE TRIGGER audit_logs_append_only_update
BEFORE UPDATE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_audit_update();

DROP TRIGGER IF EXISTS security_audit_log_append_only_update ON public.security_audit_log;
CREATE TRIGGER security_audit_log_append_only_update
BEFORE UPDATE ON public.security_audit_log
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_audit_update();
