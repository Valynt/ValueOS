-- Adds columns required by SecurityAuditService.logRequestEvent that were
-- missing from the initial security_audit_log table definition.

ALTER TABLE public.security_audit_log
  ADD COLUMN IF NOT EXISTS event_data   jsonb,
  ADD COLUMN IF NOT EXISTS request_id   text,
  ADD COLUMN IF NOT EXISTS resource     text,
  ADD COLUMN IF NOT EXISTS request_path text,
  ADD COLUMN IF NOT EXISTS ip_address   text,
  ADD COLUMN IF NOT EXISTS user_agent   text,
  ADD COLUMN IF NOT EXISTS severity     text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS status_code  integer;

CREATE INDEX IF NOT EXISTS idx_security_audit_log_request_id
  ON public.security_audit_log (request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_security_audit_log_severity
  ON public.security_audit_log (severity, created_at DESC)
  WHERE severity IS NOT NULL;
