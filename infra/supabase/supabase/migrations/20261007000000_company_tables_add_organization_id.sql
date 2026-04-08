-- ============================================================================
-- Migration: Add organization_id UUID to company_* tables
--
-- The 20260912000000_company_value_context migration created 8 tables using
-- only TEXT tenant_id. The canonical tenant key is organization_id UUID.
-- This migration adds organization_id, backfills from tenant_id via the
-- organizations table, and updates RLS policies to use organization_id.
--
-- Forward-safe: uses IF NOT EXISTS / IF EXISTS guards.
-- ============================================================================

SET search_path = public, pg_temp;

BEGIN;

-- ── 1. Add organization_id column to all 8 company tables ────────────────────

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'company_contexts',
    'company_products',
    'company_capabilities',
    'company_competitors',
    'company_personas',
    'company_value_patterns',
    'company_claim_governance',
    'company_context_versions'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id UUID',
      tbl
    );
  END LOOP;
END;
$$;

-- ── 2. Backfill organization_id from tenants → organizations mapping ─────────

-- company_contexts is the root; it has a UNIQUE(tenant_id) constraint.
-- Backfill from organizations table where id::text matches tenant_id,
-- or from the tenants table if organizations stores the mapping differently.
DO $$
BEGIN
  -- Direct cast: if tenant_id is already a UUID string, cast it.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organizations'
  ) THEN
    UPDATE public.company_contexts cc
    SET organization_id = o.id
    FROM public.organizations o
    WHERE cc.tenant_id = o.id::text
      AND cc.organization_id IS NULL;
  END IF;

  -- Fallback: cast tenant_id directly to UUID where it is a valid UUID.
  UPDATE public.company_contexts
  SET organization_id = tenant_id::uuid
  WHERE organization_id IS NULL
    AND tenant_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
END;
$$;

-- Backfill children from their parent company_contexts rows.
UPDATE public.company_products cp
SET organization_id = cc.organization_id
FROM public.company_contexts cc
WHERE cp.context_id = cc.id
  AND cp.organization_id IS NULL
  AND cc.organization_id IS NOT NULL;

UPDATE public.company_capabilities cap
SET organization_id = cp.organization_id
FROM public.company_products cp
WHERE cap.product_id = cp.id
  AND cap.organization_id IS NULL
  AND cp.organization_id IS NOT NULL;

UPDATE public.company_competitors comp
SET organization_id = cc.organization_id
FROM public.company_contexts cc
WHERE comp.context_id = cc.id
  AND comp.organization_id IS NULL
  AND cc.organization_id IS NOT NULL;

UPDATE public.company_personas per
SET organization_id = cc.organization_id
FROM public.company_contexts cc
WHERE per.context_id = cc.id
  AND per.organization_id IS NULL
  AND cc.organization_id IS NOT NULL;

UPDATE public.company_value_patterns vp
SET organization_id = cc.organization_id
FROM public.company_contexts cc
WHERE vp.context_id = cc.id
  AND vp.organization_id IS NULL
  AND cc.organization_id IS NOT NULL;

UPDATE public.company_claim_governance cg
SET organization_id = cc.organization_id
FROM public.company_contexts cc
WHERE cg.context_id = cc.id
  AND cg.organization_id IS NULL
  AND cc.organization_id IS NOT NULL;

-- company_context_versions: backfill via context_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'company_context_versions'
      AND column_name = 'context_id'
  ) THEN
    EXECUTE '
      UPDATE public.company_context_versions cv
      SET organization_id = cc.organization_id
      FROM public.company_contexts cc
      WHERE cv.context_id = cc.id
        AND cv.organization_id IS NULL
        AND cc.organization_id IS NOT NULL
    ';
  END IF;
END;
$$;

-- ── 3. Create indexes on organization_id ─────────────────────────────────────

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'company_contexts',
    'company_products',
    'company_capabilities',
    'company_competitors',
    'company_personas',
    'company_value_patterns',
    'company_claim_governance',
    'company_context_versions'
  ] LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%I_organization_id ON public.%I (organization_id)',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ── 4. Add organization_id-based RLS policies (additive, not replacing) ──────
-- Existing tenant_id policies remain so both paths work during migration period.

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'company_contexts',
    'company_products',
    'company_capabilities',
    'company_competitors',
    'company_personas',
    'company_value_patterns',
    'company_claim_governance',
    'company_context_versions'
  ] LOOP
    -- Add organization_id-based SELECT policy
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      tbl || '_org_select', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (
        security.user_has_tenant_access(organization_id)
        OR security.user_has_tenant_access(tenant_id)
      )',
      tbl || '_org_select', tbl
    );

    -- Add organization_id-based INSERT policy
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      tbl || '_org_insert', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (
        security.user_has_tenant_access(organization_id)
        OR security.user_has_tenant_access(tenant_id)
      )',
      tbl || '_org_insert', tbl
    );

    -- Add organization_id-based UPDATE policy
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      tbl || '_org_update', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (
        security.user_has_tenant_access(organization_id)
        OR security.user_has_tenant_access(tenant_id)
      )',
      tbl || '_org_update', tbl
    );

    -- Add organization_id-based DELETE policy
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      tbl || '_org_delete', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (
        security.user_has_tenant_access(organization_id)
        OR security.user_has_tenant_access(tenant_id)
      )',
      tbl || '_org_delete', tbl
    );

    -- Drop the old tenant_id-only policies
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete', tbl);
  END LOOP;
END;
$$;

COMMIT;
