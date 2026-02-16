-- ============================================================================
-- Billing V2 Phase 0 — Migration Rollback Strategy
-- ============================================================================

-- This script provides rollback capabilities for Billing V2 Phase 0
-- Run this in reverse order to undo all changes

SET search_path = public, pg_temp;

DO $$
BEGIN
    RAISE NOTICE 'Starting Billing V2 Phase 0 rollback...';
END $$;

-- ============================================================================
-- ROLLBACK: 8. Update architecture diagrams (no-op - documentation)
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Skipping architecture diagrams rollback (documentation only)';
END $$;

-- ============================================================================
-- ROLLBACK: 7. Add migration scripts + rollback strategy (this file)
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Skipping migration scripts rollback (this file)';
END $$;

-- ============================================================================
-- ROLLBACK: 6. Implement immutable rated ledger
-- ============================================================================

DO $$
BEGIN
    -- Drop rated_ledger table and related objects
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rated_ledger') THEN
        -- Drop policies first
        DROP POLICY IF EXISTS rated_ledger_tenant_read ON public.rated_ledger;

        -- Drop indexes
        DROP INDEX IF EXISTS idx_rated_ledger_tenant_period;
        DROP INDEX IF EXISTS idx_rated_ledger_subscription_period;
        DROP INDEX IF EXISTS idx_rated_ledger_meter;
        DROP INDEX IF EXISTS idx_rated_ledger_rated_at;

        -- Drop table
        DROP TABLE public.rated_ledger;

        RAISE NOTICE 'Dropped rated_ledger table and related objects';
    ELSE
        RAISE NOTICE 'rated_ledger table does not exist, skipping';
    END IF;
END $$;

-- ============================================================================
-- ROLLBACK: 5. Add idempotent usage event ingestion
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Idempotent usage event ingestion rollback: No schema changes to revert (API-only)';
END $$;

-- ============================================================================
-- ROLLBACK: 4. Implement deterministic rating engine
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Rating engine rollback: No schema changes to revert (service-only)';
END $$;

-- ============================================================================
-- ROLLBACK: 3. Create entitlement_snapshots
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'entitlement_snapshots') THEN
        -- Drop policies first
        DROP POLICY IF EXISTS entitlement_snapshots_tenant ON public.entitlement_snapshots;

        -- Drop indexes
        DROP INDEX IF EXISTS idx_entitlement_snapshots_current;
        DROP INDEX IF EXISTS idx_entitlement_snapshots_tenant_effective;

        -- Drop table
        DROP TABLE public.entitlement_snapshots;

        RAISE NOTICE 'Dropped entitlement_snapshots table and related objects';
    ELSE
        RAISE NOTICE 'entitlement_snapshots table does not exist, skipping';
    END IF;
END $$;

-- ============================================================================
-- ROLLBACK: 2. Create billing_price_versions
-- ============================================================================

DO $$
DECLARE
    version_record RECORD;
BEGIN
    -- Archive all active versions before dropping
    UPDATE public.billing_price_versions
    SET status = 'archived', archived_at = now()
    WHERE status = 'active';

    -- Drop table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_price_versions') THEN
        -- Drop policies first
        DROP POLICY IF EXISTS billing_price_versions_select ON public.billing_price_versions;

        -- Drop indexes
        DROP INDEX IF EXISTS idx_billing_price_versions_active;

        -- Drop table (this will cascade to entitlement_snapshots if not already dropped)
        DROP TABLE public.billing_price_versions;

        RAISE NOTICE 'Dropped billing_price_versions table and related objects';
    ELSE
        RAISE NOTICE 'billing_price_versions table does not exist, skipping';
    END IF;
END $$;

-- ============================================================================
-- ROLLBACK: 1. Create billing_meters
-- ============================================================================

DO $$
DECLARE
    meter_record RECORD;
BEGIN
    -- Delete seeded data
    DELETE FROM public.billing_meters
    WHERE meter_key IN ('ai_tokens', 'api_calls', 'llm_tokens', 'agent_executions', 'storage_gb', 'user_seats');

    -- Drop table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_meters') THEN
        -- Drop policies first
        DROP POLICY IF EXISTS billing_meters_select ON public.billing_meters;

        -- Drop table
        DROP TABLE public.billing_meters;

        RAISE NOTICE 'Dropped billing_meters table and related objects';
    ELSE
        RAISE NOTICE 'billing_meters table does not exist, skipping';
    END IF;
END $$;

-- ============================================================================
-- ROLLBACK: Additional cleanup from billing_v2_foundation migration
-- ============================================================================

DO $$
BEGIN
    -- Revert usage_events alterations
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'usage_events' AND column_name = 'idempotency_key') THEN
        ALTER TABLE public.usage_events DROP COLUMN IF EXISTS idempotency_key;
        ALTER TABLE public.usage_events DROP COLUMN IF EXISTS signature;
        DROP INDEX IF EXISTS idx_usage_events_idempotency;
        RAISE NOTICE 'Reverted usage_events alterations';
    END IF;

    -- Revert usage_aggregates alterations
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'usage_aggregates' AND column_name = 'period_id') THEN
        ALTER TABLE public.usage_aggregates DROP COLUMN IF EXISTS period_id;
        ALTER TABLE public.usage_aggregates DROP COLUMN IF EXISTS source_event_count;
        ALTER TABLE public.usage_aggregates DROP COLUMN IF EXISTS source_hash;
        RAISE NOTICE 'Reverted usage_aggregates alterations';
    END IF;

    -- Revert subscriptions alterations
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'price_version_id') THEN
        ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS price_version_id;
        RAISE NOTICE 'Reverted subscriptions alterations';
    END IF;

    -- Revert invoices alterations
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'price_version_id') THEN
        ALTER TABLE public.invoices DROP COLUMN IF EXISTS price_version_id;
        RAISE NOTICE 'Reverted invoices alterations';
    END IF;

    -- Drop additional tables from foundation migration
    DROP TABLE IF EXISTS public.usage_policies;
    DROP TABLE IF EXISTS public.billing_approval_policies;
    DROP TABLE IF EXISTS public.billing_approval_requests;

    -- Revert CHECK constraints on usage tables
    ALTER TABLE public.usage_events DROP CONSTRAINT IF EXISTS usage_events_metric_check;
    ALTER TABLE public.usage_events ADD CONSTRAINT usage_events_metric_check
        CHECK (metric IN ('llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats'));

    ALTER TABLE public.usage_aggregates DROP CONSTRAINT IF EXISTS usage_aggregates_metric_check;
    ALTER TABLE public.usage_aggregates ADD CONSTRAINT usage_aggregates_metric_check
        CHECK (metric IN ('llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats'));

    ALTER TABLE public.usage_alerts DROP CONSTRAINT IF EXISTS usage_alerts_metric_check;
    ALTER TABLE public.usage_alerts ADD CONSTRAINT usage_alerts_metric_check
        CHECK (metric IN ('llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats'));

    ALTER TABLE public.usage_quotas DROP CONSTRAINT IF EXISTS usage_quotas_metric_check;
    ALTER TABLE public.usage_quotas ADD CONSTRAINT usage_quotas_metric_check
        CHECK (metric IN ('llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats'));

    ALTER TABLE public.subscription_items DROP CONSTRAINT IF EXISTS subscription_items_metric_check;
    ALTER TABLE public.subscription_items ADD CONSTRAINT subscription_items_metric_check
        CHECK (metric IN ('llm_tokens', 'agent_executions', 'api_calls', 'storage_gb', 'user_seats'));

    RAISE NOTICE 'Completed additional cleanup from billing_v2_foundation migration';
END $$;

DO $$
BEGIN
    RAISE NOTICE 'Billing V2 Phase 0 rollback completed successfully';
    RAISE NOTICE 'Note: Manual cleanup may be required for:';
    RAISE NOTICE '  - Application code changes (RatingEngine service, usage-events API)';
    RAISE NOTICE '  - Updated architecture documentation';
    RAISE NOTICE '  - Any downstream services or integrations';
END $$;
