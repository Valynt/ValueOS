-- ============================================================================
-- Billing Infrastructure
-- Created: 2024-11-29
-- Implements Stripe-based metered billing with usage quotas
-- ============================================================================

-- ============================================================================
-- 1. Billing Customers (Tenant → Stripe Customer Mapping)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant reference
  tenant_id UUID NOT NULL UNIQUE,
  organization_name TEXT NOT NULL,
  
  -- Stripe references
  stripe_customer_id TEXT NOT NULL UNIQUE,
  stripe_customer_email TEXT,
  
  -- Status
  status TEXT CHECK (status IN ('active', 'suspended', 'cancelled')) DEFAULT 'active',
  
  -- Payment info
  default_payment_method TEXT,
  payment_method_type TEXT,
  card_last4 TEXT,
  card_brand TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_billing_customers_tenant ON public.billing_customers(tenant_id);
CREATE INDEX idx_billing_customers_stripe ON public.billing_customers(stripe_customer_id);
CREATE INDEX idx_billing_customers_status ON public.billing_customers(status);

COMMENT ON TABLE public.billing_customers IS 
'Maps tenants to Stripe customers for billing';

-- ============================================================================
-- 2. Subscriptions (Active Subscription per Tenant)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Customer reference
  billing_customer_id UUID REFERENCES public.billing_customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Stripe references
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  
  -- Plan info
  plan_tier TEXT CHECK (plan_tier IN ('free', 'standard', 'enterprise')) NOT NULL,
  billing_period TEXT CHECK (billing_period IN ('monthly', 'yearly')) DEFAULT 'monthly',
  
  -- Status
  status TEXT CHECK (status IN (
    'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'trialing'
  )) NOT NULL,
  
  -- Dates
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  -- Pricing
  amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'usd',
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_customer ON public.subscriptions(billing_customer_id);
CREATE INDEX idx_subscriptions_tenant ON public.subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_stripe ON public.subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_period ON public.subscriptions(current_period_start, current_period_end);

COMMENT ON TABLE public.subscriptions IS 
'Active subscriptions per tenant with billing periods';

-- ============================================================================
-- 3. Subscription Items (Metered Products per Subscription)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Subscription reference
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  
  -- Stripe references
  stripe_subscription_item_id TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT NOT NULL,
  stripe_product_id TEXT NOT NULL,
  
  -- Metric info
  metric TEXT CHECK (metric IN (
    'llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats'
  )) NOT NULL,
  
  -- Pricing
  unit_amount DECIMAL(10, 4),
  currency TEXT DEFAULT 'usd',
  
  -- Metering
  usage_type TEXT CHECK (usage_type IN ('metered', 'licensed')) DEFAULT 'metered',
  aggregation TEXT CHECK (aggregation IN ('sum', 'max', 'last_during_period')) DEFAULT 'sum',
  
  -- Quota
  included_quantity INTEGER,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscription_items_subscription ON public.subscription_items(subscription_id);
CREATE INDEX idx_subscription_items_metric ON public.subscription_items(metric);
CREATE INDEX idx_subscription_items_stripe_item ON public.subscription_items(stripe_subscription_item_id);

COMMENT ON TABLE public.subscription_items IS 
'Metered line items per subscription (one per metric)';

-- ============================================================================
-- 4. Usage Events (Raw Usage Records - Queue Source)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant reference
  tenant_id UUID NOT NULL,
  
  -- Metric info
  metric TEXT CHECK (metric IN (
    'llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats'
  )) NOT NULL,
  
  -- Usage amount
  amount DECIMAL(15, 4) NOT NULL CHECK (amount >= 0),
  
  -- Request tracking
  request_id TEXT NOT NULL,
  
  -- Context
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Processing status
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  
  -- Timestamps
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_events_tenant ON public.usage_events(tenant_id);
CREATE INDEX idx_usage_events_metric ON public.usage_events(metric);
CREATE INDEX idx_usage_events_timestamp ON public.usage_events(timestamp DESC);
CREATE INDEX idx_usage_events_processed ON public.usage_events(processed, timestamp) WHERE NOT processed;
CREATE INDEX idx_usage_events_request ON public.usage_events(request_id);

COMMENT ON TABLE public.usage_events IS 
'Raw usage events emitted from services (queue source for aggregation)';

-- ============================================================================
-- 5. Usage Aggregates (Batched Usage for Stripe Submission)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usage_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant reference
  tenant_id UUID NOT NULL,
  subscription_item_id UUID REFERENCES public.subscription_items(id) ON DELETE CASCADE,
  
  -- Metric info
  metric TEXT CHECK (metric IN (
    'llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats'
  )) NOT NULL,
  
  -- Aggregated amount
  total_amount DECIMAL(15, 4) NOT NULL,
  event_count INTEGER NOT NULL,
  
  -- Time window
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Stripe submission
  submitted_to_stripe BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMPTZ,
  stripe_usage_record_id TEXT,
  
  -- Idempotency
  idempotency_key TEXT NOT NULL UNIQUE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_aggregates_tenant ON public.usage_aggregates(tenant_id);
CREATE INDEX idx_usage_aggregates_metric ON public.usage_aggregates(metric);
CREATE INDEX idx_usage_aggregates_period ON public.usage_aggregates(period_start, period_end);
CREATE INDEX idx_usage_aggregates_submitted ON public.usage_aggregates(submitted_to_stripe, created_at) 
  WHERE NOT submitted_to_stripe;
CREATE INDEX idx_usage_aggregates_idempotency ON public.usage_aggregates(idempotency_key);

COMMENT ON TABLE public.usage_aggregates IS 
'Aggregated usage ready for Stripe submission (batched from events)';

-- ============================================================================
-- 6. Invoices (Stripe Invoice Storage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Customer reference
  billing_customer_id UUID REFERENCES public.billing_customers(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  
  -- Stripe references
  stripe_invoice_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  
  -- Invoice details
  invoice_number TEXT,
  invoice_pdf_url TEXT,
  hosted_invoice_url TEXT,
  
  -- Amounts
  amount_due DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) DEFAULT 0,
  amount_remaining DECIMAL(10, 2),
  subtotal DECIMAL(10, 2),
  tax DECIMAL(10, 2),
  total DECIMAL(10, 2),
  currency TEXT DEFAULT 'usd',
  
  -- Status
  status TEXT CHECK (status IN (
    'draft', 'open', 'paid', 'void', 'uncollectible'
  )) NOT NULL,
  
  -- Dates
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  -- Line items (JSON)
  line_items JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_customer ON public.invoices(billing_customer_id);
CREATE INDEX idx_invoices_tenant ON public.invoices(tenant_id);
CREATE INDEX idx_invoices_stripe ON public.invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_period ON public.invoices(period_start, period_end);

COMMENT ON TABLE public.invoices IS 
'Stored Stripe invoices per tenant for history/UI';

-- ============================================================================
-- 7. Usage Quotas (Plan Limits per Tenant)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usage_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant reference
  tenant_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  
  -- Metric
  metric TEXT CHECK (metric IN (
    'llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats'
  )) NOT NULL,
  
  -- Quota limits
  quota_amount DECIMAL(15, 4) NOT NULL,
  hard_cap BOOLEAN DEFAULT FALSE,
  
  -- Current usage (cached)
  current_usage DECIMAL(15, 4) DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  
  -- Period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, metric, period_start)
);

CREATE INDEX idx_usage_quotas_tenant ON public.usage_quotas(tenant_id);
CREATE INDEX idx_usage_quotas_metric ON public.usage_quotas(metric);
CREATE INDEX idx_usage_quotas_period ON public.usage_quotas(period_start, period_end);
CREATE INDEX idx_usage_quotas_sync ON public.usage_quotas(last_synced_at);

COMMENT ON TABLE public.usage_quotas IS 
'Plan quotas and current usage per tenant/metric (cached from Stripe)';

-- ============================================================================
-- 8. Usage Alerts (Quota Warning History)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usage_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant reference
  tenant_id UUID NOT NULL,
  
  -- Alert details
  metric TEXT CHECK (metric IN (
    'llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats'
  )) NOT NULL,
  
  threshold_percentage INTEGER CHECK (threshold_percentage IN (80, 100, 120)),
  current_usage DECIMAL(15, 4),
  quota_amount DECIMAL(15, 4),
  
  -- Alert status
  alert_type TEXT CHECK (alert_type IN ('warning', 'critical', 'exceeded')) NOT NULL,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  
  -- Notification
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_alerts_tenant ON public.usage_alerts(tenant_id);
CREATE INDEX idx_usage_alerts_metric ON public.usage_alerts(metric);
CREATE INDEX idx_usage_alerts_acknowledged ON public.usage_alerts(acknowledged);
CREATE INDEX idx_usage_alerts_created ON public.usage_alerts(created_at DESC);

COMMENT ON TABLE public.usage_alerts IS 
'Usage alert history (80%/100%/120% thresholds)';

-- ============================================================================
-- 9. Webhook Events (Stripe Webhook Processing Log)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Stripe event details
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  
  -- Payload
  payload JSONB NOT NULL,
  
  -- Processing status
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_stripe ON public.webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_type ON public.webhook_events(event_type);
CREATE INDEX idx_webhook_events_processed ON public.webhook_events(processed, received_at) WHERE NOT processed;

COMMENT ON TABLE public.webhook_events IS 
'Stripe webhook event log for idempotent processing';

-- ============================================================================
-- Functions
-- ============================================================================

-- Get current usage for a tenant/metric
CREATE OR REPLACE FUNCTION public.get_current_usage(
  p_tenant_id UUID,
  p_metric TEXT,
  p_period_start TIMESTAMPTZ DEFAULT date_trunc('month', NOW()),
  p_period_end TIMESTAMPTZ DEFAULT date_trunc('month', NOW()) + INTERVAL '1 month'
)
RETURNS DECIMAL(15, 4) AS $$
DECLARE
  total_usage DECIMAL(15, 4);
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO total_usage
  FROM public.usage_events
  WHERE tenant_id = p_tenant_id
    AND metric = p_metric
    AND timestamp >= p_period_start
    AND timestamp < p_period_end;
  
  RETURN total_usage;
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if tenant is over quota
CREATE OR REPLACE FUNCTION public.is_over_quota(
  p_tenant_id UUID,
  p_metric TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  quota_rec RECORD;
  current_usage DECIMAL(15, 4);
BEGIN
  -- Get current quota
  SELECT * INTO quota_rec
  FROM public.usage_quotas
  WHERE tenant_id = p_tenant_id
    AND metric = p_metric
    AND NOW() >= period_start
    AND NOW() < period_end
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN FALSE; -- No quota = unlimited
  END IF;
  
  -- Get current usage
  current_usage := public.get_current_usage(
    p_tenant_id,
    p_metric,
    quota_rec.period_start,
    quota_rec.period_end
  );
  
  RETURN current_usage >= quota_rec.quota_amount;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get usage percentage
CREATE OR REPLACE FUNCTION public.get_usage_percentage(
  p_tenant_id UUID,
  p_metric TEXT
)
RETURNS INTEGER AS $$
DECLARE
  quota_rec RECORD;
  current_usage DECIMAL(15, 4);
  percentage INTEGER;
BEGIN
  SELECT * INTO quota_rec
  FROM public.usage_quotas
  WHERE tenant_id = p_tenant_id
    AND metric = p_metric
    AND NOW() >= period_start
    AND NOW() < period_end
  LIMIT 1;
  
  IF NOT FOUND OR quota_rec.quota_amount = 0 THEN
    RETURN 0;
  END IF;
  
  current_usage := public.get_current_usage(
    p_tenant_id,
    p_metric,
    quota_rec.period_start,
    quota_rec.period_end
  );
  
  percentage := ROUND((current_usage / quota_rec.quota_amount) * 100);
  
  RETURN LEAST(percentage, 999); -- Cap at 999%
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_alerts ENABLE ROW LEVEL SECURITY;

-- Admins can manage all billing data
CREATE POLICY "admins_full_access_billing"
  ON public.billing_customers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Users can view their own tenant's billing data
CREATE POLICY "users_view_own_billing"
  ON public.billing_customers FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenants
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Apply similar policies to other tables
CREATE POLICY "admins_full_access_subscriptions"
  ON public.subscriptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "users_view_own_subscriptions"
  ON public.subscriptions FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_tenants
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ============================================================================
-- Summary
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Billing Infrastructure Installed!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - billing_customers (Stripe customer mapping)';
  RAISE NOTICE '  - subscriptions (Active subscriptions)';
  RAISE NOTICE '  - subscription_items (Metered products)';
  RAISE NOTICE '  - usage_events (Raw usage queue)';
  RAISE NOTICE '  - usage_aggregates (Batched for Stripe)';
  RAISE NOTICE '  - invoices (Invoice storage)';
  RAISE NOTICE '  - usage_quotas (Plan limits + current usage)';
  RAISE NOTICE '  - usage_alerts (Quota warnings)';
  RAISE NOTICE '  - webhook_events (Stripe webhook log)';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  - get_current_usage(tenant_id, metric, period)';
  RAISE NOTICE '  - is_over_quota(tenant_id, metric)';
  RAISE NOTICE '  - get_usage_percentage(tenant_id, metric)';
  RAISE NOTICE '';
  RAISE NOTICE 'Metrics supported:';
  RAISE NOTICE '  - llm_tokens';
  RAISE NOTICE '  - agent_executions';
  RAISE NOTICE '  - api_calls';
  RAISE NOTICE '  - storage_gb';
  RAISE NOTICE '  - user_seats';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Set up Stripe products and configure environment';
  RAISE NOTICE '';
END $$;
