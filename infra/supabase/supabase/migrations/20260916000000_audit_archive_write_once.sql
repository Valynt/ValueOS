-- Immutable archive tables for compliance retention.
-- Ensures audit retention copies rows into append-only archive tables with
-- verification metadata before active-row cleanup proceeds.

SET search_path = public, pg_temp;

DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pgcrypto;
EXCEPTION WHEN others THEN RAISE NOTICE 'pgcrypto: skipped (%)', SQLERRM; END $$;

CREATE TABLE IF NOT EXISTS public.security_audit_log_archive (
  LIKE public.security_audit_log INCLUDING ALL
);

ALTER TABLE public.audit_logs_archive
  ADD COLUMN IF NOT EXISTS source_table text NOT NULL DEFAULT 'audit_logs',
  ADD COLUMN IF NOT EXISTS archive_batch_id uuid,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archive_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_verification jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.security_audit_log_archive
  ADD COLUMN IF NOT EXISTS source_table text NOT NULL DEFAULT 'security_audit_log',
  ADD COLUMN IF NOT EXISTS archive_batch_id uuid,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS archive_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_verification jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_tenant_timestamp
  ON public.audit_logs_archive (tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_archive_tenant_timestamp
  ON public.security_audit_log_archive (tenant_id, archived_at DESC);

ALTER TABLE public.security_audit_log_archive ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.audit_logs_archive FROM authenticated;
REVOKE ALL ON public.audit_logs_archive FROM service_role;
REVOKE ALL ON public.security_audit_log_archive FROM authenticated;
REVOKE ALL ON public.security_audit_log_archive FROM service_role;

GRANT SELECT ON public.audit_logs_archive TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs_archive TO service_role;
GRANT SELECT ON public.security_audit_log_archive TO authenticated;
GRANT SELECT, INSERT ON public.security_audit_log_archive TO service_role;

DROP POLICY IF EXISTS audit_logs_archive_service_role ON public.audit_logs_archive;
CREATE POLICY audit_logs_archive_service_role_select ON public.audit_logs_archive
  FOR SELECT TO service_role
  USING (true);

CREATE POLICY audit_logs_archive_service_role_insert ON public.audit_logs_archive
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS security_audit_log_archive_authorized_select ON public.security_audit_log_archive;
DROP POLICY IF EXISTS security_audit_log_archive_tenant_select ON public.security_audit_log_archive;
DROP POLICY IF EXISTS security_audit_log_archive_service_role ON public.security_audit_log_archive;

CREATE POLICY security_audit_log_archive_authorized_select ON public.security_audit_log_archive
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    security.user_has_tenant_access(tenant_id)
    AND (security.jwt_has_scope('audit.read') OR security.jwt_has_scope('compliance.read'))
  );

CREATE POLICY security_audit_log_archive_service_role_select ON public.security_audit_log_archive
  FOR SELECT TO service_role
  USING (true);

CREATE POLICY security_audit_log_archive_service_role_insert ON public.security_audit_log_archive
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.prevent_audit_archive_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'immutable audit archive rows are write-once and cannot be %', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_archive_immutable ON public.audit_logs_archive;
CREATE TRIGGER audit_logs_archive_immutable
BEFORE UPDATE OR DELETE ON public.audit_logs_archive
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_archive_mutation();

DROP TRIGGER IF EXISTS security_audit_log_archive_immutable ON public.security_audit_log_archive;
CREATE TRIGGER security_audit_log_archive_immutable
BEFORE UPDATE OR DELETE ON public.security_audit_log_archive
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_archive_mutation();
