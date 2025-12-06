-- Migration: Add grace_periods table
-- Tracks grace periods for soft quota limits

CREATE TABLE IF NOT EXISTS grace_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    metric TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    quota_at_start BIGINT NOT NULL,
    usage_at_start BIGINT NOT NULL,
    notified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grace_periods_tenant_metric ON grace_periods (tenant_id, metric);
CREATE INDEX IF NOT EXISTS idx_grace_periods_expires ON grace_periods (expires_at);
CREATE INDEX IF NOT EXISTS idx_grace_periods_notified ON grace_periods (notified) WHERE notified = FALSE;

-- RLS
ALTER TABLE grace_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY grace_periods_select ON grace_periods
  FOR SELECT USING (tenant_id = auth.get_current_org_id());

CREATE POLICY grace_periods_insert ON grace_periods
  FOR INSERT WITH CHECK (tenant_id = auth.get_current_org_id());

CREATE POLICY grace_periods_update ON grace_periods
  FOR UPDATE USING (tenant_id = auth.get_current_org_id())
  WITH CHECK (tenant_id = auth.get_current_org_id());

CREATE POLICY grace_periods_delete ON grace_periods
  FOR DELETE USING (tenant_id = auth.get_current_org_id());
