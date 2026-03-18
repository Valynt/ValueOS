-- Billing v2: Additional columns for usage aggregates and existing tables
-- Adds period_id, source_event_count, source_hash to usage_aggregates
-- Adds price_version_id FK to subscriptions and invoices

SET search_path = public, pg_temp;

-- ============================================================================
-- 1. ALTER usage_aggregates: add period_id, source_event_count, source_hash
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usage_aggregates' AND column_name = 'period_id'
  ) THEN
    ALTER TABLE public.usage_aggregates ADD COLUMN period_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usage_aggregates' AND column_name = 'source_event_count'
  ) THEN
    ALTER TABLE public.usage_aggregates ADD COLUMN source_event_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usage_aggregates' AND column_name = 'source_hash'
  ) THEN
    ALTER TABLE public.usage_aggregates ADD COLUMN source_hash text;
  END IF;
END $$;

COMMENT ON COLUMN public.usage_aggregates.period_id IS 'Billing period identifier (YYYY-MM format)';
COMMENT ON COLUMN public.usage_aggregates.source_event_count IS 'Number of source usage events aggregated';
COMMENT ON COLUMN public.usage_aggregates.source_hash IS 'Hash of aggregated event IDs for audit trail';

CREATE INDEX IF NOT EXISTS idx_usage_aggregates_period_id
  ON public.usage_aggregates (period_id) WHERE period_id IS NOT NULL;

-- ============================================================================
-- 2. ALTER subscriptions: add price_version_id FK
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'price_version_id'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN price_version_id uuid REFERENCES public.billing_price_versions(id);
  END IF;
END $$;

COMMENT ON COLUMN public.subscriptions.price_version_id IS 'Pinned price version for this subscription';

CREATE INDEX IF NOT EXISTS idx_subscriptions_price_version_id
  ON public.subscriptions (price_version_id) WHERE price_version_id IS NOT NULL;

-- ============================================================================
-- 3. ALTER invoices: add price_version_id FK
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'price_version_id'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN price_version_id uuid REFERENCES public.billing_price_versions(id);
  END IF;
END $$;

COMMENT ON COLUMN public.invoices.price_version_id IS 'Price version used for invoice calculation';

CREATE INDEX IF NOT EXISTS idx_invoices_price_version_id
  ON public.invoices (price_version_id) WHERE price_version_id IS NOT NULL;
