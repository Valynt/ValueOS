-- Rollback for billing_v2_alter_tables migration
-- Removes added columns from usage_aggregates, subscriptions, and invoices

SET search_path = public, pg_temp;

-- Drop indexes first
DROP INDEX IF EXISTS idx_usage_aggregates_period_id;
DROP INDEX IF EXISTS idx_subscriptions_price_version_id;
DROP INDEX IF EXISTS idx_invoices_price_version_id;

-- Remove columns (if they exist, ignore errors)
DO $$
BEGIN
  -- usage_aggregates columns
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usage_aggregates' AND column_name = 'period_id'
  ) THEN
    ALTER TABLE public.usage_aggregates DROP COLUMN period_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usage_aggregates' AND column_name = 'source_event_count'
  ) THEN
    ALTER TABLE public.usage_aggregates DROP COLUMN source_event_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usage_aggregates' AND column_name = 'source_hash'
  ) THEN
    ALTER TABLE public.usage_aggregates DROP COLUMN source_hash;
  END IF;

  -- subscriptions price_version_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'price_version_id'
  ) THEN
    ALTER TABLE public.subscriptions DROP COLUMN price_version_id;
  END IF;

  -- invoices price_version_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'price_version_id'
  ) THEN
    ALTER TABLE public.invoices DROP COLUMN price_version_id;
  END IF;
END $$;
