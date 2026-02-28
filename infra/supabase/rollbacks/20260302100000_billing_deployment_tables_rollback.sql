-- ============================================================================
-- ROLLBACK: 20260302100000_billing_deployment_tables
-- Reverses the billing deployment tables migration.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file.sql
-- ============================================================================

SET search_path = public, pg_temp;

-- Remove seeded billing feature flags
DELETE FROM public.feature_flags
WHERE key IN (
    'billing.usage_metering',
    'billing.overage_charging',
    'billing.approval_workflows',
    'billing.invoice_generation'
);

-- Drop feature_flag_evaluations
DROP TABLE IF EXISTS public.feature_flag_evaluations CASCADE;

-- Drop feature_flags
DROP TABLE IF EXISTS public.feature_flags CASCADE;

-- Drop approval_attachments
DROP TABLE IF EXISTS public.approval_attachments CASCADE;

-- Drop approval_requests
DROP TABLE IF EXISTS public.approval_requests CASCADE;

-- Remove aggregated column from usage_records (if it was added by this migration)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'usage_records'
          AND column_name = 'aggregated'
    ) THEN
        DROP INDEX IF EXISTS idx_usage_records_unaggregated;
        ALTER TABLE public.usage_records DROP COLUMN IF EXISTS aggregated;
    END IF;
END $$;
