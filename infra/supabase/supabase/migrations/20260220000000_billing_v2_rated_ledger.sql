-- ============================================================================
-- Billing V2 Phase 0 — Immutable Rated Ledger
-- ============================================================================

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. rated_ledger — Immutable rated usage ledger
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rated_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    subscription_id uuid NOT NULL,
    price_version_id uuid NOT NULL REFERENCES public.billing_price_versions(id),
    meter_key text NOT NULL REFERENCES public.billing_meters(meter_key),
    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    quantity_used numeric(15,4) NOT NULL DEFAULT 0,
    quantity_included numeric(15,4) NOT NULL DEFAULT 0,
    quantity_overage numeric(15,4) NOT NULL DEFAULT 0,
    unit_price numeric(10,6) NOT NULL DEFAULT 0,
    amount numeric(15,4) NOT NULL DEFAULT 0,
    rated_at timestamptz NOT NULL DEFAULT now(),
    rated_by text NOT NULL,
    source_aggregate_hash text NOT NULL,
    created_at timestamptz DEFAULT now(),

    -- Constraints
    CONSTRAINT rated_ledger_positive_quantities CHECK (
        quantity_used >= 0 AND quantity_included >= 0 AND quantity_overage >= 0
    ),
    CONSTRAINT rated_ledger_period_order CHECK (period_start < period_end),
    CONSTRAINT rated_ledger_amount_calculation CHECK (
        amount = quantity_overage * unit_price
    ),

    -- Unique constraint ensures immutability - same rating inputs produce same result
    CONSTRAINT rated_ledger_unique_rating UNIQUE (
        tenant_id, subscription_id, meter_key, period_start, period_end, source_aggregate_hash
    )
);

COMMENT ON TABLE public.rated_ledger IS 'Immutable ledger of rated usage line items. Append-only; never modified.';

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_rated_ledger_tenant_period
    ON public.rated_ledger (tenant_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_rated_ledger_subscription_period
    ON public.rated_ledger (subscription_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_rated_ledger_meter
    ON public.rated_ledger (meter_key);

CREATE INDEX IF NOT EXISTS idx_rated_ledger_rated_at
    ON public.rated_ledger (rated_at);

-- ============================================================================
-- 2. RLS policies for rated_ledger
-- ============================================================================

ALTER TABLE public.rated_ledger ENABLE ROW LEVEL SECURITY;

-- Tenants can read their own rated line items
CREATE POLICY rated_ledger_tenant_read ON public.rated_ledger
    FOR SELECT TO authenticated
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Service role has full access for rating operations
GRANT ALL ON public.rated_ledger TO service_role;

-- Authenticated users can read their tenant's data
GRANT SELECT ON public.rated_ledger TO authenticated;
