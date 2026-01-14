-- RLS/ABAC policy sketch for multi-tenant data protection (Phase 3)
-- Adjust table/column names to your schema.

-- Example: prompts table
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- Enforce tenant isolation
CREATE POLICY tenant_isolation ON prompts
  USING (tenant_id = current_setting('request.jwt.claim.tenant_id', true));

-- Optional: role-based access
CREATE POLICY role_based_access ON prompts
  FOR SELECT USING (
    current_setting('request.jwt.claim.role', true) IN ('admin', 'analyst')
  );

-- TTL cleanup can be handled by a scheduled job (DB cron/worker):
-- DELETE FROM prompts WHERE created_at < now() - interval '30 days';

-- Audit log immutability: disable UPDATE/DELETE; use insert-only
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;
COMMENT ON TABLE audit_logs IS 'Append-only; updates/deletes prohibited';

