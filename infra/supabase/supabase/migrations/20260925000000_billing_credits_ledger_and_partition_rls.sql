SET search_path = public, pg_temp;

BEGIN;

-- rls-classification: tenant_scoped
CREATE TABLE IF NOT EXISTS public.billing_credits_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  credit_id text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  invoice_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL UNIQUE
);

ALTER TABLE public.billing_credits_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_credits_ledger_tenant_select ON public.billing_credits_ledger;
CREATE POLICY billing_credits_ledger_tenant_select ON public.billing_credits_ledger
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (security.user_has_tenant_access(tenant_id::text));

DROP POLICY IF EXISTS billing_credits_ledger_service_role_all ON public.billing_credits_ledger;
CREATE POLICY billing_credits_ledger_service_role_all ON public.billing_credits_ledger
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.billing_credits_ledger TO authenticated;
GRANT ALL ON public.billing_credits_ledger TO service_role;

-- rls-classification: service_only
CREATE TABLE IF NOT EXISTS public.pending_subscription_creations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_tier text NOT NULL,
  create_request_id text,
  idempotency_key text NOT NULL UNIQUE,
  stripe_subscription_id text,
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'needs_reconciliation')),
  failure_reason text,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_subscription_creations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pending_subscription_creations_service_role_all ON public.pending_subscription_creations;
CREATE POLICY pending_subscription_creations_service_role_all ON public.pending_subscription_creations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.pending_subscription_creations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.pending_subscription_creations TO service_role;

-- Backfill initial credit rows from organizations.settings->billing_credits.
INSERT INTO public.billing_credits_ledger (
  tenant_id,
  credit_id,
  amount,
  type,
  invoice_id,
  idempotency_key
)
SELECT
  o.tenant_id,
  'legacy-billing-credits',
  ROUND(((o.settings->>'billing_credits')::numeric / 100.0)::numeric, 2),
  'credit',
  NULL,
  o.tenant_id::text || ':seed:legacy-billing-credits'
FROM public.organizations o
WHERE (o.settings ? 'billing_credits')
  AND (o.settings->>'billing_credits') ~ '^[0-9]+$'
ON CONFLICT (idempotency_key) DO NOTHING;

-- Ensure partition helper enables RLS for future partitions.
CREATE OR REPLACE FUNCTION public.create_next_monthly_partitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  tables  text[] := ARRAY[
    'usage_ledger', 'rated_ledger', 'saga_transitions', 'value_loop_events'
  ];
  tbl     text;
  m1_start timestamptz := date_trunc('month', now() + interval '1 month');
  m1_end   timestamptz := m1_start + interval '1 month';
  m2_start timestamptz := m1_end;
  m2_end   timestamptz := m2_start + interval '1 month';
  p1_name  text;
  p2_name  text;
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    p1_name := tbl || '_p_' || to_char(m1_start, 'YYYY_MM');
    p2_name := tbl || '_p_' || to_char(m2_start, 'YYYY_MM');

    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = p1_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
        p1_name, tbl, m1_start, m1_end
      );
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p1_name);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = p2_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
        p2_name, tbl, m2_start, m2_end
      );
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p2_name);
    END IF;
  END LOOP;
END;
$$;

-- One-time remediation for existing partition child tables.
DO $$
DECLARE
  partition record;
BEGIN
  FOR partition IN
    SELECT c.relname AS child_name
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_class p ON p.oid = i.inhparent
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND p.relname IN ('usage_ledger', 'rated_ledger', 'saga_transitions', 'value_loop_events')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', partition.child_name);
  END LOOP;
END $$;

COMMIT;
