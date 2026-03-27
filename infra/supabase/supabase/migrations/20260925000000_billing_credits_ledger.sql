-- billing_credits_ledger
--
-- Replaces the static `organizations.settings->billing_credits` JSONB field
-- with an append-only ledger. Each row is either a credit grant (positive
-- amount_cents) or a debit applied during invoice calculation (negative).
--
-- The available balance for a tenant is:
--   SELECT COALESCE(SUM(amount_cents), 0) FROM billing_credits_ledger
--   WHERE tenant_id = $1;
--
-- Debits are written by InvoiceMathEngine at invoice-calculation time and
-- are idempotent via the (tenant_id, invoice_period_start, invoice_period_end)
-- unique constraint — re-running the same invoice period never double-debits.

BEGIN;

CREATE TABLE IF NOT EXISTS public.billing_credits_ledger (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL,
  -- Positive = credit grant, negative = debit applied to an invoice
  amount_cents        integer     NOT NULL,
  -- 'grant' | 'invoice_debit' | 'manual_adjustment' | 'expiry'
  entry_type          text        NOT NULL,
  -- For invoice_debit rows: the period this debit covers
  invoice_period_start timestamptz,
  invoice_period_end   timestamptz,
  -- For invoice_debit rows: the subscription that was invoiced
  subscription_id     uuid,
  description         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          text        NOT NULL DEFAULT 'system'
);

-- Prevent double-debit for the same invoice period on the same subscription
CREATE UNIQUE INDEX IF NOT EXISTS billing_credits_ledger_invoice_debit_uniq
  ON public.billing_credits_ledger (tenant_id, subscription_id, invoice_period_start, invoice_period_end)
  WHERE entry_type = 'invoice_debit';

CREATE INDEX IF NOT EXISTS billing_credits_ledger_tenant_idx
  ON public.billing_credits_ledger (tenant_id, created_at DESC);

-- RLS: tenants see only their own rows; service_role bypasses
ALTER TABLE public.billing_credits_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_credits_ledger_tenant_select
  ON public.billing_credits_ledger
  FOR SELECT
  USING (tenant_id::text = current_setting('app.tenant_id', true));

-- Only service_role may insert/update/delete (no user-facing mutations)
-- service_role bypasses RLS, so no explicit policy is needed for writes.

COMMENT ON TABLE public.billing_credits_ledger IS
  'Append-only ledger of credit grants and invoice debits per tenant. '
  'Balance = SUM(amount_cents). Replaces organizations.settings->billing_credits.';

COMMIT;
