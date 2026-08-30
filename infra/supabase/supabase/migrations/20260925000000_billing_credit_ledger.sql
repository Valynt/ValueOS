-- Billing credit ledger
--
-- Replaces the static billing_credits JSONB field on organizations.settings
-- with an append-only double-entry ledger. Each credit issuance is a row with
-- entry_type='credit'; each invoice application is a row with entry_type='debit'
-- referencing the invoice that consumed it.
--
-- The current spendable balance for a tenant is:
--   SUM(amount_cents) FILTER (WHERE entry_type = 'credit')
--   - SUM(amount_cents) FILTER (WHERE entry_type = 'debit')
--
-- A unique constraint on (tenant_id, invoice_id) prevents the same invoice
-- from debiting credits more than once, eliminating the double-application bug.

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. billing_credit_ledger table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.billing_credit_ledger (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL,
  entry_type      text        NOT NULL CHECK (entry_type IN ('credit', 'debit')),
  -- Stored in cents (integer) to avoid floating-point accumulation errors.
  amount_cents    bigint      NOT NULL CHECK (amount_cents > 0),
  -- For debits: the invoice that consumed these credits. NULL for credit issuances.
  invoice_id      uuid        REFERENCES public.invoices(id) ON DELETE RESTRICT,
  -- Human-readable reason (e.g. "promotional credit", "invoice INV-0042 applied").
  reason          text        NOT NULL DEFAULT '',
  -- Idempotency key supplied by the caller. Prevents duplicate issuances from
  -- retried API calls or webhook replays.
  idempotency_key text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- One debit per invoice — the core constraint that prevents double-application.
  CONSTRAINT uq_credit_ledger_invoice UNIQUE (invoice_id),
  -- One issuance per idempotency key per tenant.
  CONSTRAINT uq_credit_ledger_idempotency UNIQUE (tenant_id, idempotency_key)
);

COMMENT ON TABLE public.billing_credit_ledger IS
  'Append-only ledger of credit issuances and invoice deductions. '
  'Balance = SUM(credits) - SUM(debits). '
  'The UNIQUE(invoice_id) constraint prevents double-application.';

COMMENT ON COLUMN public.billing_credit_ledger.amount_cents IS
  'Credit or debit amount in cents. Always positive; entry_type determines direction.';

COMMENT ON COLUMN public.billing_credit_ledger.idempotency_key IS
  'Caller-supplied key to make credit issuances safe to retry. '
  'Scoped per tenant via the UNIQUE(tenant_id, idempotency_key) constraint.';

-- ============================================================================
-- 2. Indexes
-- ============================================================================

-- Primary access pattern: balance query for a tenant.
CREATE INDEX IF NOT EXISTS idx_credit_ledger_tenant_id
  ON public.billing_credit_ledger (tenant_id, entry_type);

-- Lookup by invoice when verifying debit existence.
CREATE INDEX IF NOT EXISTS idx_credit_ledger_invoice_id
  ON public.billing_credit_ledger (invoice_id)
  WHERE invoice_id IS NOT NULL;

-- ============================================================================
-- 3. Row-level security
-- ============================================================================

ALTER TABLE public.billing_credit_ledger ENABLE ROW LEVEL SECURITY;

-- Tenants may read their own ledger rows.
CREATE POLICY credit_ledger_tenant_select
  ON public.billing_credit_ledger FOR SELECT
  USING (security.user_has_tenant_access(tenant_id::text));

-- Inserts are performed by the backend via service_role, which bypasses RLS
-- entirely. This policy blocks all authenticated (user-role) inserts.
CREATE POLICY credit_ledger_service_insert
  ON public.billing_credit_ledger FOR INSERT
  WITH CHECK (false);

-- No UPDATE or DELETE — the ledger is append-only.
-- To reverse an erroneous credit, void it by issuing a new 'debit' row
-- (without an invoice_id) with an explanatory reason. The amount_cents
-- CHECK (amount_cents > 0) is intentional: direction is encoded in
-- entry_type, never in the sign of the amount.

-- ============================================================================
-- 4. Helper view: current balance per tenant
-- ============================================================================

CREATE OR REPLACE VIEW public.billing_credit_balances
  WITH (security_invoker = true)
AS
SELECT
  tenant_id,
  COALESCE(SUM(amount_cents) FILTER (WHERE entry_type = 'credit'), 0)
    - COALESCE(SUM(amount_cents) FILTER (WHERE entry_type = 'debit'), 0)
    AS balance_cents,
  COUNT(*) FILTER (WHERE entry_type = 'credit') AS credit_count,
  COUNT(*) FILTER (WHERE entry_type = 'debit')  AS debit_count,
  MAX(created_at)                                AS last_activity_at
FROM public.billing_credit_ledger
GROUP BY tenant_id;

COMMENT ON VIEW public.billing_credit_balances IS
  'Current spendable credit balance per tenant, derived from the ledger. '
  'security_invoker=true ensures RLS on billing_credit_ledger is enforced for the querying user. '
  'balance_cents may be negative if debits exceed credits (data integrity issue).';

-- ============================================================================
-- 5. RPC: consume_invoice_credits
--
-- Atomically debits available credits against an invoice. Called by the
-- billing engine during invoice finalisation. Returns the amount actually
-- debited (may be less than requested if balance is insufficient).
--
-- Parameters:
--   p_tenant_id    — tenant whose credits to consume
--   p_invoice_id   — invoice being finalised (enforces UNIQUE debit constraint)
--   p_amount_cents — requested debit amount (invoice amount_due in cents)
--
-- Returns: actual_debit_cents bigint
-- ============================================================================

CREATE OR REPLACE FUNCTION public.consume_invoice_credits(
  p_tenant_id    uuid,
  p_invoice_id   uuid,
  p_amount_cents bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance      bigint;
  v_debit_amount bigint;
BEGIN
  -- Validate inputs.
  IF p_amount_cents <= 0 THEN
    RETURN 0;
  END IF;

  -- Authorisation: the calling user must have access to this tenant.
  -- SECURITY DEFINER bypasses RLS on the table, so we enforce the check
  -- explicitly here. Service-role callers always pass this check.
  IF NOT security.user_has_tenant_access(p_tenant_id::text) THEN
    RAISE EXCEPTION 'consume_invoice_credits: unauthorized for tenant %', p_tenant_id
      USING ERRCODE = '42501';
  END IF;

  -- Lock per-tenant to prevent concurrent double-application.
  -- Uses a 64-bit hash derived from the tenant UUID to avoid the ~50% collision
  -- probability at 77k tenants that hashtext() (32-bit) would produce.
  PERFORM pg_advisory_xact_lock(('x' || md5(p_tenant_id::text))::bit(64)::bigint);

  -- Check whether a debit for this invoice already exists (idempotency).
  IF EXISTS (
    SELECT 1 FROM public.billing_credit_ledger
    WHERE invoice_id = p_invoice_id
  ) THEN
    -- Return the previously recorded debit amount.
    SELECT amount_cents INTO v_debit_amount
    FROM public.billing_credit_ledger
    WHERE invoice_id = p_invoice_id;
    RETURN v_debit_amount;
  END IF;

  -- Compute current balance.
  SELECT
    COALESCE(SUM(amount_cents) FILTER (WHERE entry_type = 'credit'), 0)
    - COALESCE(SUM(amount_cents) FILTER (WHERE entry_type = 'debit'), 0)
  INTO v_balance
  FROM public.billing_credit_ledger
  WHERE tenant_id = p_tenant_id;

  -- Nothing to debit.
  IF v_balance <= 0 THEN
    RETURN 0;
  END IF;

  -- Debit the lesser of requested amount and available balance.
  v_debit_amount := LEAST(p_amount_cents, v_balance);

  INSERT INTO public.billing_credit_ledger (
    tenant_id, entry_type, amount_cents, invoice_id, reason
  ) VALUES (
    p_tenant_id,
    'debit',
    v_debit_amount,
    p_invoice_id,
    'Applied to invoice ' || p_invoice_id::text
  );

  RETURN v_debit_amount;
END;
$$;

COMMENT ON FUNCTION public.consume_invoice_credits IS
  'Atomically debit credits for an invoice. '
  'Idempotent: re-calling with the same invoice_id returns the original debit. '
  'Uses a per-tenant advisory lock to prevent concurrent double-application.';

-- ============================================================================
-- 6. Grants
-- ============================================================================

-- authenticated: table-level SELECT is required for RLS policies to fire.
GRANT SELECT ON public.billing_credit_ledger TO authenticated;
GRANT SELECT ON public.billing_credit_balances TO authenticated;

-- service_role: full access for backend operations.
GRANT ALL ON public.billing_credit_ledger TO service_role;
GRANT ALL ON public.billing_credit_balances TO service_role;

-- The RPC is called by the backend via service_role.
GRANT EXECUTE ON FUNCTION public.consume_invoice_credits(uuid, uuid, bigint) TO service_role;
