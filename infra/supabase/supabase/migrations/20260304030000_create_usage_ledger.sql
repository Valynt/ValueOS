-- ============================================================================
-- Migration: Create usage_ledger for value-based billing ingestion
-- Purpose: Track billable agent usage with strict tenant scoping + idempotency
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usage_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    agent_id text NOT NULL,
    value_units numeric(14,4) NOT NULL CHECK (value_units >= 0),
    evidence_link text NOT NULL,
    request_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.usage_ledger IS 'Tenant-scoped value ledger for billable agent actions';
COMMENT ON COLUMN public.usage_ledger.request_id IS 'Idempotency key for usage ingestion per tenant';

-- Tenant-first indexes for high-cardinality billing lookups
CREATE INDEX IF NOT EXISTS idx_usage_ledger_tenant_created_at
  ON public.usage_ledger (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_tenant_agent_created_at
  ON public.usage_ledger (tenant_id, agent_id, created_at DESC);

-- DB-level idempotency (tenant-safe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_ledger_tenant_request_unique
  ON public.usage_ledger (tenant_id, request_id);

ALTER TABLE public.usage_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usage_ledger_tenant_isolation ON public.usage_ledger;
CREATE POLICY usage_ledger_tenant_isolation ON public.usage_ledger
  FOR ALL TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

GRANT ALL ON public.usage_ledger TO service_role;
GRANT SELECT, INSERT ON public.usage_ledger TO authenticated;
