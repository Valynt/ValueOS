-- Source (legacy): ValueOS/infra/db/migrations/20260128_add_idx_opportunities_valuecase_tenant.sql
-- Migration: Add composite index on opportunities(value_case_id, tenant_id) in authoritative infra/postgres/migrations path

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opportunities_value_case_tenant
  ON opportunities (value_case_id, tenant_id);

-- Down migration (manual rollback)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_opportunities_value_case_tenant;
