-- Migration: Billing schema with tenant-scoped RLS
-- This migration introduces billing plans, subscriptions, entitlements,
-- metering, and invoicing tables with strict organization-level isolation.

-- ============================================
-- Billing Plans (per-tenant)
-- ============================================
CREATE TABLE IF NOT EXISTS billing_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'annual')),
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    features JSONB NOT NULL DEFAULT '{}'::JSONB,
    limits JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, code)
);

-- ============================================
-- Subscriptions per tenant
-- ============================================
CREATE TABLE IF NOT EXISTS billing_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES billing_plans(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    external_reference TEXT, -- Stripe/charge provider id
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, plan_id)
);

-- ============================================
-- Entitlements derived from plans or overrides
-- ============================================
CREATE TABLE IF NOT EXISTS billing_entitlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES billing_subscriptions(id) ON DELETE CASCADE,
    feature_code TEXT NOT NULL,
    limit_type TEXT NOT NULL CHECK (limit_type IN ('hard', 'soft', 'metered')),
    limit_value BIGINT,
    period TEXT CHECK (period IN ('daily', 'monthly', 'annual', 'lifetime')),
    usage_reset_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, feature_code, subscription_id)
);

-- ============================================
-- Raw usage events for metering
-- ============================================
CREATE TABLE IF NOT EXISTS billing_usage_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
    feature_code TEXT NOT NULL,
    quantity NUMERIC(20,4) NOT NULL DEFAULT 1,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source TEXT DEFAULT 'system',
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);

-- ============================================
-- Daily aggregates to feed invoices/alerts
-- ============================================
CREATE TABLE IF NOT EXISTS billing_usage_daily_totals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    feature_code TEXT NOT NULL,
    usage_date DATE NOT NULL,
    quantity NUMERIC(20,4) NOT NULL DEFAULT 0,
    last_event_at TIMESTAMPTZ,
    UNIQUE (organization_id, feature_code, usage_date)
);

-- ============================================
-- Invoices & line items (for downstream billing provider sync)
-- ============================================
CREATE TABLE IF NOT EXISTS billing_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    total_cents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
    external_reference TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS billing_invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(20,4) NOT NULL DEFAULT 1,
    unit_amount_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    feature_code TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_billing_plans_org_active ON billing_plans (organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_org_status ON billing_subscriptions (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_entitlements_org_feature ON billing_entitlements (organization_id, feature_code);
CREATE INDEX IF NOT EXISTS idx_billing_usage_events_org_time ON billing_usage_events (organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_usage_daily_org_feature_date ON billing_usage_daily_totals (organization_id, feature_code, usage_date);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_org_status ON billing_invoices (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_invoice_items_invoice ON billing_invoice_items (invoice_id);

-- ============================================
-- Row-Level Security (tenant scoped)
-- ============================================
ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_usage_daily_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_invoice_items ENABLE ROW LEVEL SECURITY;

-- Plans
CREATE POLICY billing_plans_select ON billing_plans
  FOR SELECT USING (organization_id = auth.get_current_org_id());
CREATE POLICY billing_plans_insert ON billing_plans
  FOR INSERT WITH CHECK (organization_id = auth.get_current_org_id());
CREATE POLICY billing_plans_update ON billing_plans
  FOR UPDATE USING (organization_id = auth.get_current_org_id())
  WITH CHECK (organization_id = auth.get_current_org_id());
CREATE POLICY billing_plans_delete ON billing_plans
  FOR DELETE USING (organization_id = auth.get_current_org_id());

-- Subscriptions
CREATE POLICY billing_subscriptions_select ON billing_subscriptions
  FOR SELECT USING (organization_id = auth.get_current_org_id());
CREATE POLICY billing_subscriptions_insert ON billing_subscriptions
  FOR INSERT WITH CHECK (organization_id = auth.get_current_org_id());
CREATE POLICY billing_subscriptions_update ON billing_subscriptions
  FOR UPDATE USING (organization_id = auth.get_current_org_id())
  WITH CHECK (organization_id = auth.get_current_org_id());
CREATE POLICY billing_subscriptions_delete ON billing_subscriptions
  FOR DELETE USING (organization_id = auth.get_current_org_id());

-- Entitlements
CREATE POLICY billing_entitlements_select ON billing_entitlements
  FOR SELECT USING (organization_id = auth.get_current_org_id());
CREATE POLICY billing_entitlements_insert ON billing_entitlements
  FOR INSERT WITH CHECK (organization_id = auth.get_current_org_id());
CREATE POLICY billing_entitlements_update ON billing_entitlements
  FOR UPDATE USING (organization_id = auth.get_current_org_id())
  WITH CHECK (organization_id = auth.get_current_org_id());
CREATE POLICY billing_entitlements_delete ON billing_entitlements
  FOR DELETE USING (organization_id = auth.get_current_org_id());

-- Usage events
CREATE POLICY billing_usage_events_select ON billing_usage_events
  FOR SELECT USING (organization_id = auth.get_current_org_id());
CREATE POLICY billing_usage_events_insert ON billing_usage_events
  FOR INSERT WITH CHECK (organization_id = auth.get_current_org_id());
CREATE POLICY billing_usage_events_update ON billing_usage_events
  FOR UPDATE USING (organization_id = auth.get_current_org_id())
  WITH CHECK (organization_id = auth.get_current_org_id());
CREATE POLICY billing_usage_events_delete ON billing_usage_events
  FOR DELETE USING (organization_id = auth.get_current_org_id());

-- Usage daily totals
CREATE POLICY billing_usage_daily_totals_select ON billing_usage_daily_totals
  FOR SELECT USING (organization_id = auth.get_current_org_id());
CREATE POLICY billing_usage_daily_totals_insert ON billing_usage_daily_totals
  FOR INSERT WITH CHECK (organization_id = auth.get_current_org_id());
CREATE POLICY billing_usage_daily_totals_update ON billing_usage_daily_totals
  FOR UPDATE USING (organization_id = auth.get_current_org_id())
  WITH CHECK (organization_id = auth.get_current_org_id());
CREATE POLICY billing_usage_daily_totals_delete ON billing_usage_daily_totals
  FOR DELETE USING (organization_id = auth.get_current_org_id());

-- Invoices
CREATE POLICY billing_invoices_select ON billing_invoices
  FOR SELECT USING (organization_id = auth.get_current_org_id());
CREATE POLICY billing_invoices_insert ON billing_invoices
  FOR INSERT WITH CHECK (organization_id = auth.get_current_org_id());
CREATE POLICY billing_invoices_update ON billing_invoices
  FOR UPDATE USING (organization_id = auth.get_current_org_id())
  WITH CHECK (organization_id = auth.get_current_org_id());
CREATE POLICY billing_invoices_delete ON billing_invoices
  FOR DELETE USING (organization_id = auth.get_current_org_id());

-- Invoice items
CREATE POLICY billing_invoice_items_select ON billing_invoice_items
  FOR SELECT USING (organization_id = auth.get_current_org_id());
CREATE POLICY billing_invoice_items_insert ON billing_invoice_items
  FOR INSERT WITH CHECK (organization_id = auth.get_current_org_id());
CREATE POLICY billing_invoice_items_update ON billing_invoice_items
  FOR UPDATE USING (organization_id = auth.get_current_org_id())
  WITH CHECK (organization_id = auth.get_current_org_id());
CREATE POLICY billing_invoice_items_delete ON billing_invoice_items
  FOR DELETE USING (organization_id = auth.get_current_org_id());
