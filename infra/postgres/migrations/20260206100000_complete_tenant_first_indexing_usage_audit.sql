-- Migration: Complete tenant-first indexing for usage billing and audit/event query paths.
-- Expected predicates: WHERE tenant_id = ? (or organization_id surrogate for audit_logs)
-- with additional filters on metric/alert_type/action and ORDER BY period_start|created_at DESC.
-- Column order is tenant scope first to maximize selectivity and keep per-tenant recency scans index-only.

-- usage_aggregates: tenant billing rollups by metric with reverse-chronological period scans.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_aggregates_tenant_period_start_metric
  ON public.usage_aggregates (tenant_id, period_start DESC, metric);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_usage_aggregates_tenant_period_start_metric;

-- usage_alerts: tenant usage threshold timelines filtered by metric/alert_type and sorted by newest first.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_alerts_tenant_created_at_metric_alert_type
  ON public.usage_alerts (tenant_id, created_at DESC, metric, alert_type);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_usage_alerts_tenant_created_at_metric_alert_type;

-- audit_logs: schema has organization_id (no tenant_id column), standardized as tenant surrogate for tenant-scoped audit timelines.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_tenant_action_created_at
  ON public.audit_logs (organization_id, action, created_at DESC);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_audit_logs_tenant_action_created_at;

COMMENT ON INDEX idx_audit_logs_tenant_action_created_at IS
  'organization_id is the tenant surrogate for audit_logs tenant-scoped event queries';

-- security_audit_events: explicit tenant_id support for per-tenant security event timelines.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_audit_events_tenant_action_timestamp
  ON public.security_audit_events (tenant_id, action, "timestamp" DESC);
-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_security_audit_events_tenant_action_timestamp;
