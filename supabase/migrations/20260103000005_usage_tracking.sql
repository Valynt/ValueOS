-- Usage Tracking Tables
-- Purpose: Track usage for billing and quota enforcement
-- Compliance: SOC2 CC6.7

-- Usage Events Table
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  metric TEXT NOT NULL CHECK (metric IN (
    'llm_tokens',
    'agent_executions',
    'api_calls',
    'storage_gb',
    'user_seats'
  )),
  amount BIGINT NOT NULL CHECK (amount >= 0),
  request_id TEXT NOT NULL UNIQUE, -- Idempotency key
  metadata JSONB DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_id ON usage_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_metric ON usage_events(metric);
CREATE INDEX IF NOT EXISTS idx_usage_events_timestamp ON usage_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_events_processed ON usage_events(processed);
CREATE INDEX IF NOT EXISTS idx_usage_events_request_id ON usage_events(request_id);

COMMENT ON TABLE usage_events IS 'Individual usage events for billing';
COMMENT ON COLUMN usage_events.request_id IS 'Idempotency key to prevent duplicate events';

-- Usage Quotas Table
CREATE TABLE IF NOT EXISTS usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  subscription_id UUID,
  metric TEXT NOT NULL CHECK (metric IN (
    'llm_tokens',
    'agent_executions',
    'api_calls',
    'storage_gb',
    'user_seats'
  )),
  quota_amount BIGINT NOT NULL CHECK (quota_amount >= -1), -- -1 means unlimited
  current_usage BIGINT NOT NULL DEFAULT 0 CHECK (current_usage >= 0),
  hard_cap BOOLEAN NOT NULL DEFAULT FALSE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, metric, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_quotas_tenant_id ON usage_quotas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_quotas_metric ON usage_quotas(metric);
CREATE INDEX IF NOT EXISTS idx_usage_quotas_period ON usage_quotas(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_usage_quotas_subscription_id ON usage_quotas(subscription_id);

COMMENT ON TABLE usage_quotas IS 'Usage quotas and current usage by tenant and metric';
COMMENT ON COLUMN usage_quotas.quota_amount IS 'Maximum allowed usage (-1 for unlimited)';
COMMENT ON COLUMN usage_quotas.hard_cap IS 'Whether to strictly enforce quota (true) or allow overage (false)';

-- Enable RLS
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_quotas ENABLE ROW LEVEL SECURITY;

-- Policies for usage_events
CREATE POLICY usage_events_tenant_read ON usage_events
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY usage_events_service_role ON usage_events
  FOR ALL
  TO service_role
  USING (true);

-- Policies for usage_quotas
CREATE POLICY usage_quotas_tenant_read ON usage_quotas
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenants
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY usage_quotas_service_role ON usage_quotas
  FOR ALL
  TO service_role
  USING (true);

-- Function to check and enforce usage quota
CREATE OR REPLACE FUNCTION check_usage_quota(
  p_tenant_id UUID,
  p_metric TEXT,
  p_amount BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
  v_quota usage_quotas%ROWTYPE;
  v_new_usage BIGINT;
BEGIN
  -- Get current quota
  SELECT * INTO v_quota
  FROM usage_quotas
  WHERE tenant_id = p_tenant_id
  AND metric = p_metric
  AND period_start <= NOW()
  AND period_end > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No quota found for tenant % and metric %', p_tenant_id, p_metric;
  END IF;

  v_new_usage := v_quota.current_usage + p_amount;

  -- Check if quota would be exceeded
  IF v_quota.hard_cap AND v_quota.quota_amount != -1 AND v_new_usage > v_quota.quota_amount THEN
    RETURN FALSE;
  END IF;

  -- Update usage
  UPDATE usage_quotas
  SET current_usage = v_new_usage,
      updated_at = NOW(),
      last_synced_at = NOW()
  WHERE id = v_quota.id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record usage event
CREATE OR REPLACE FUNCTION record_usage_event(
  p_tenant_id UUID,
  p_metric TEXT,
  p_amount BIGINT,
  p_request_id TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Insert usage event (idempotent via request_id unique constraint)
  INSERT INTO usage_events (
    tenant_id,
    metric,
    amount,
    request_id,
    metadata
  ) VALUES (
    p_tenant_id,
    p_metric,
    p_amount,
    p_request_id,
    p_metadata
  )
  ON CONFLICT (request_id) DO NOTHING
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset monthly quotas
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS INTEGER AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  -- Reset quotas where period has ended
  UPDATE usage_quotas
  SET current_usage = 0,
      period_start = period_end,
      period_end = period_end + INTERVAL '1 month',
      updated_at = NOW()
  WHERE period_end <= NOW()
  RETURNING COUNT(*) INTO v_reset_count;

  RETURN v_reset_count;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate usage events
CREATE OR REPLACE FUNCTION aggregate_usage_events()
RETURNS INTEGER AS $$
DECLARE
  v_processed_count INTEGER;
BEGIN
  -- Aggregate unprocessed events into quotas
  WITH aggregated AS (
    SELECT
      tenant_id,
      metric,
      SUM(amount) as total_amount
    FROM usage_events
    WHERE processed = FALSE
    AND timestamp >= NOW() - INTERVAL '1 hour'
    GROUP BY tenant_id, metric
  )
  UPDATE usage_quotas uq
  SET current_usage = current_usage + a.total_amount,
      updated_at = NOW(),
      last_synced_at = NOW()
  FROM aggregated a
  WHERE uq.tenant_id = a.tenant_id
  AND uq.metric = a.metric
  AND uq.period_start <= NOW()
  AND uq.period_end > NOW();

  -- Mark events as processed
  UPDATE usage_events
  SET processed = TRUE,
      processed_at = NOW()
  WHERE processed = FALSE
  AND timestamp >= NOW() - INTERVAL '1 hour'
  RETURNING COUNT(*) INTO v_processed_count;

  RETURN v_processed_count;
END;
$$ LANGUAGE plpgsql;
