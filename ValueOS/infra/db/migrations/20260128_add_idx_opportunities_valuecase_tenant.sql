-- Migration: Add composite index on opportunities(value_case_id, tenant_id)
-- Up
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opportunities_value_case_tenant
  ON opportunities (value_case_id, tenant_id);

-- Down
-- DROP INDEX CONCURRENTLY IF EXISTS idx_opportunities_value_case_tenant;
