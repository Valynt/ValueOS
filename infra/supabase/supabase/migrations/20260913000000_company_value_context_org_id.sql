-- Migration: Add organization_id UUID to company_value_context tables
--
-- Context: 20260912000000_company_value_context.sql created 8 tables using the
-- legacy TEXT tenant_id pattern. This migration adds organization_id UUID NOT NULL
-- to all 8 tables, backfills from public.organizations, and updates RLS policies
-- to enforce organization_id instead of the legacy TEXT tenant_id.
--
-- Deployment notes:
--   - Run backfill in batches if tables have significant data (see step 3).
--   - The NOT NULL constraint is added after backfill to avoid locking.
--   - Legacy tenant_id columns are retained for backward compatibility;
--     remove them in a follow-up migration once all query paths are updated.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- ============================================================
-- Step 1: Add nullable organization_id to all 8 tables
-- ============================================================

ALTER TABLE public.company_contexts
  ADD COLUMN IF NOT EXISTS organization_id UUID;

ALTER TABLE public.company_products
  ADD COLUMN IF NOT EXISTS organization_id UUID;

ALTER TABLE public.company_capabilities
  ADD COLUMN IF NOT EXISTS organization_id UUID;

ALTER TABLE public.company_competitors
  ADD COLUMN IF NOT EXISTS organization_id UUID;

ALTER TABLE public.company_personas
  ADD COLUMN IF NOT EXISTS organization_id UUID;

ALTER TABLE public.company_value_patterns
  ADD COLUMN IF NOT EXISTS organization_id UUID;

ALTER TABLE public.company_claim_governance
  ADD COLUMN IF NOT EXISTS organization_id UUID;

ALTER TABLE public.company_context_versions
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- ============================================================
-- Step 2: Backfill organization_id from public.organizations
--
-- company_contexts is the root table; all child tables join through it.
-- Batch size: 1000 rows per update to avoid long table locks.
-- ============================================================

-- Root table: company_contexts
DO $$
DECLARE
  batch_size  INT := 1000;
  rows_updated INT;
BEGIN
  LOOP
    -- Use CTE with LIMIT for batch processing
    WITH batch AS (
      SELECT cc.id
      FROM public.company_contexts cc
      JOIN public.organizations o ON o.tenant_id = cc.tenant_id
      WHERE cc.organization_id IS NULL
      LIMIT batch_size
    )
    UPDATE public.company_contexts cc
    SET    organization_id = o.id
    FROM   batch
    JOIN   public.organizations o ON o.tenant_id = (SELECT tenant_id FROM public.company_contexts WHERE id = batch.id)
    WHERE  cc.id = batch.id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated = 0;
  END LOOP;
END;
$$;

-- Child tables: propagate from company_contexts via context_id FK
DO $$
DECLARE
  batch_size  INT := 1000;
  rows_updated INT;
BEGIN
  -- company_products
  LOOP
    WITH batch AS (
      SELECT cp.id
      FROM public.company_products cp
      JOIN public.company_contexts cc ON cc.id = cp.context_id
      WHERE cp.organization_id IS NULL
        AND cc.organization_id IS NOT NULL
      LIMIT batch_size
    )
    UPDATE public.company_products cp
    SET    organization_id = cc.organization_id
    FROM   batch
    JOIN   public.company_contexts cc ON cc.id = (SELECT context_id FROM public.company_products WHERE id = batch.id)
    WHERE  cp.id = batch.id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated = 0;
  END LOOP;

  -- company_competitors
  LOOP
    WITH batch AS (
      SELECT cc2.id
      FROM public.company_competitors cc2
      JOIN public.company_contexts cc ON cc.id = cc2.context_id
      WHERE cc2.organization_id IS NULL
        AND cc.organization_id IS NOT NULL
      LIMIT batch_size
    )
    UPDATE public.company_competitors cc2
    SET    organization_id = cc.organization_id
    FROM   batch
    JOIN   public.company_contexts cc ON cc.id = (SELECT context_id FROM public.company_competitors WHERE id = batch.id)
    WHERE  cc2.id = batch.id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated = 0;
  END LOOP;

  -- company_personas
  LOOP
    WITH batch AS (
      SELECT cp.id
      FROM public.company_personas cp
      JOIN public.company_contexts cc ON cc.id = cp.context_id
      WHERE cp.organization_id IS NULL
        AND cc.organization_id IS NOT NULL
      LIMIT batch_size
    )
    UPDATE public.company_personas cp
    SET    organization_id = cc.organization_id
    FROM   batch
    JOIN   public.company_contexts cc ON cc.id = (SELECT context_id FROM public.company_personas WHERE id = batch.id)
    WHERE  cp.id = batch.id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated = 0;
  END LOOP;

  -- company_value_patterns
  LOOP
    WITH batch AS (
      SELECT cvp.id
      FROM public.company_value_patterns cvp
      JOIN public.company_contexts cc ON cc.id = cvp.context_id
      WHERE cvp.organization_id IS NULL
        AND cc.organization_id IS NOT NULL
      LIMIT batch_size
    )
    UPDATE public.company_value_patterns cvp
    SET    organization_id = cc.organization_id
    FROM   batch
    JOIN   public.company_contexts cc ON cc.id = (SELECT context_id FROM public.company_value_patterns WHERE id = batch.id)
    WHERE  cvp.id = batch.id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated = 0;
  END LOOP;

  -- company_claim_governance
  LOOP
    WITH batch AS (
      SELECT ccg.id
      FROM public.company_claim_governance ccg
      JOIN public.company_contexts cc ON cc.id = ccg.context_id
      WHERE ccg.organization_id IS NULL
        AND cc.organization_id IS NOT NULL
      LIMIT batch_size
    )
    UPDATE public.company_claim_governance ccg
    SET    organization_id = cc.organization_id
    FROM   batch
    JOIN   public.company_contexts cc ON cc.id = (SELECT context_id FROM public.company_claim_governance WHERE id = batch.id)
    WHERE  ccg.id = batch.id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated = 0;
  END LOOP;

  -- company_context_versions
  LOOP
    WITH batch AS (
      SELECT ccv.id
      FROM public.company_context_versions ccv
      JOIN public.company_contexts cc ON cc.id = ccv.context_id
      WHERE ccv.organization_id IS NULL
        AND cc.organization_id IS NOT NULL
      LIMIT batch_size
    )
    UPDATE public.company_context_versions ccv
    SET    organization_id = cc.organization_id
    FROM   batch
    JOIN   public.company_contexts cc ON cc.id = (SELECT context_id FROM public.company_context_versions WHERE id = batch.id)
    WHERE  ccv.id = batch.id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated = 0;
  END LOOP;
END;
$$;

-- company_capabilities: joins through company_products → company_contexts
DO $$
DECLARE
  batch_size  INT := 1000;
  rows_updated INT;
BEGIN
  LOOP
    WITH batch AS (
      SELECT cap.id
      FROM public.company_capabilities cap
      JOIN public.company_products cp ON cp.id = cap.product_id
      JOIN public.company_contexts cc ON cc.id = cp.context_id
      WHERE cap.organization_id IS NULL
        AND cc.organization_id IS NOT NULL
      LIMIT batch_size
    )
    UPDATE public.company_capabilities cap
    SET    organization_id = cc.organization_id
    FROM   batch
    JOIN   public.company_products cp ON cp.id = (SELECT product_id FROM public.company_capabilities WHERE id = batch.id)
    JOIN   public.company_contexts cc ON cc.id = cp.context_id
    WHERE  cap.id = batch.id;

    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    EXIT WHEN rows_updated = 0;
  END LOOP;
END;
$$;

-- ============================================================
-- Step 3: Verify backfill completeness before enforcing NOT NULL
-- ============================================================

DO $$
DECLARE
  tbl   TEXT;
  cnt   BIGINT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'company_contexts', 'company_products', 'company_capabilities',
    'company_competitors', 'company_personas', 'company_value_patterns',
    'company_claim_governance', 'company_context_versions'
  ] LOOP
    EXECUTE format(
      'SELECT COUNT(*) FROM public.%I WHERE organization_id IS NULL', tbl
    ) INTO cnt;

    IF cnt > 0 THEN
      RAISE EXCEPTION
        'Backfill incomplete: % rows in public.% have NULL organization_id. '
        'Ensure all tenant_id values exist in public.organizations before re-running.',
        cnt, tbl;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- Step 4: Enforce NOT NULL now that backfill is verified
-- ============================================================

ALTER TABLE public.company_contexts
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.company_products
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.company_capabilities
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.company_competitors
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.company_personas
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.company_value_patterns
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.company_claim_governance
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.company_context_versions
  ALTER COLUMN organization_id SET NOT NULL;

-- ============================================================
-- Step 5: Add indexes on organization_id for query performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_company_contexts_org_id
  ON public.company_contexts (organization_id);

CREATE INDEX IF NOT EXISTS idx_company_products_org_id
  ON public.company_products (organization_id);

CREATE INDEX IF NOT EXISTS idx_company_capabilities_org_id
  ON public.company_capabilities (organization_id);

CREATE INDEX IF NOT EXISTS idx_company_competitors_org_id
  ON public.company_competitors (organization_id);

CREATE INDEX IF NOT EXISTS idx_company_personas_org_id
  ON public.company_personas (organization_id);

CREATE INDEX IF NOT EXISTS idx_company_value_patterns_org_id
  ON public.company_value_patterns (organization_id);

CREATE INDEX IF NOT EXISTS idx_company_claim_governance_org_id
  ON public.company_claim_governance (organization_id);

CREATE INDEX IF NOT EXISTS idx_company_context_versions_org_id
  ON public.company_context_versions (organization_id);

-- ============================================================
-- Step 6: Replace RLS policies to enforce organization_id
--
-- Drop the legacy tenant_id-based policies and create new ones
-- that filter on organization_id UUID using the UUID overload of
-- security.user_has_tenant_access(), which resolves via user_tenants.
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'company_contexts', 'company_products', 'company_capabilities',
    'company_competitors', 'company_personas', 'company_value_patterns',
    'company_claim_governance', 'company_context_versions'
  ] LOOP
    -- Drop legacy tenant_id policies
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete', tbl);

    -- Create organization_id-based policies
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT '
      'USING (security.user_has_tenant_access(organization_id))',
      tbl || '_select', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT '
      'WITH CHECK (security.user_has_tenant_access(organization_id))',
      tbl || '_insert', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE '
      'USING (security.user_has_tenant_access(organization_id))',
      tbl || '_update', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE '
      'USING (security.user_has_tenant_access(organization_id))',
      tbl || '_delete', tbl
    );
  END LOOP;
END;
$$;
