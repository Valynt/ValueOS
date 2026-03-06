-- Add request_id (trace correlation) to audit_logs and agent_audit_log.
--
-- request_id links DB write events to the originating HTTP request via
-- requestAuditMiddleware. This enables post-incident investigation by
-- joining audit rows to request logs using a single correlation ID.
--
-- Strategy: add as nullable first so existing rows are not rejected.
-- Enforce NOT NULL after the application layer is confirmed to populate
-- the column on all write paths (separate migration or same deploy).

SET search_path = public, pg_temp;

-- audit_logs
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS request_id TEXT;

COMMENT ON COLUMN public.audit_logs.request_id IS
  'HTTP request ID from X-Request-Id header. Correlates this audit event '
  'to the originating request in access logs and distributed traces.';

CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id
  ON public.audit_logs (request_id)
  WHERE request_id IS NOT NULL;

-- agent_audit_log
ALTER TABLE public.agent_audit_log
  ADD COLUMN IF NOT EXISTS request_id TEXT;

COMMENT ON COLUMN public.agent_audit_log.request_id IS
  'HTTP request ID from X-Request-Id header. Correlates this agent audit '
  'event to the originating request in access logs and distributed traces.';

CREATE INDEX IF NOT EXISTS idx_agent_audit_log_request_id
  ON public.agent_audit_log (request_id)
  WHERE request_id IS NOT NULL;
