-- Ensure security audit log writes are restricted to service role
REVOKE INSERT, UPDATE, DELETE ON TABLE public.security_audit_log FROM anon, authenticated;
GRANT INSERT ON TABLE public.security_audit_log TO service_role;

-- Restrict inserts to service role under RLS
DROP POLICY IF EXISTS security_audit_log_service_role_insert ON public.security_audit_log;
CREATE POLICY security_audit_log_service_role_insert
  ON public.security_audit_log
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
