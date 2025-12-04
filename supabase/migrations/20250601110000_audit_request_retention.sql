-- Add request correlation fields to security audit logging and set up retention/archival hooks
-- Provides request_id-aware audit events and a retention-friendly archival path

begin;

-- Extend security_audit_log with structured request metadata
ALTER TABLE public.security_audit_log
  ADD COLUMN IF NOT EXISTS request_id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS resource TEXT,
  ADD COLUMN IF NOT EXISTS request_path TEXT,
  ADD COLUMN IF NOT EXISTS status_code INTEGER,
  ADD COLUMN IF NOT EXISTS actor TEXT;

CREATE INDEX IF NOT EXISTS idx_security_audit_request_id
  ON public.security_audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_created_at
  ON public.security_audit_log(created_at DESC);

-- Archive table to support log rotation without losing immutability guarantees
CREATE TABLE IF NOT EXISTS public.security_audit_log_archive (
  id UUID NOT NULL,
  request_id UUID,
  user_id UUID,
  actor TEXT,
  action TEXT,
  resource TEXT,
  request_path TEXT,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  ip_address INET,
  user_agent TEXT,
  severity TEXT,
  status_code INTEGER,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.security_audit_log_archive IS 'Archived security audit events for long-term retention';

-- Updated immutability guard to optionally allow controlled cleanup via app.allow_audit_gc flag
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow controlled cleanup/rotation when explicitly enabled for the session
  IF current_setting('app.allow_audit_gc', true) = 'on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Ensure archive table is also immutable during normal operations
DROP TRIGGER IF EXISTS tr_protect_security_audit_archive ON public.security_audit_log_archive;
CREATE TRIGGER tr_protect_security_audit_archive
  BEFORE UPDATE OR DELETE ON public.security_audit_log_archive
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_modification();

-- Rotation procedure copies records then prunes originals when GC flag is enabled
CREATE OR REPLACE FUNCTION public.rotate_security_audit_logs(retention_days INTEGER DEFAULT 180)
RETURNS INTEGER AS $$
DECLARE
  moved_count INTEGER := 0;
BEGIN
  PERFORM set_config('app.allow_audit_gc', 'on', true);

  INSERT INTO public.security_audit_log_archive (
    id,
    request_id,
    user_id,
    actor,
    action,
    resource,
    request_path,
    event_type,
    event_data,
    ip_address,
    user_agent,
    severity,
    status_code,
    created_at
  )
  SELECT
    id,
    request_id,
    user_id,
    actor,
    action,
    resource,
    request_path,
    event_type,
    event_data,
    ip_address,
    user_agent,
    severity,
    status_code,
    created_at
  FROM public.security_audit_log
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS moved_count = ROW_COUNT;

  DELETE FROM public.security_audit_log
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

  PERFORM set_config('app.allow_audit_gc', 'off', true);

  RETURN moved_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.rotate_security_audit_logs IS 'Archives and prunes security audit events older than the configured retention window';

commit;
