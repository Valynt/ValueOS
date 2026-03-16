-- ============================================================================
-- Migration: value-case related tables organization scoping
--
-- Adds organization_id to post-v1 value-case child tables and backfills from
-- value_cases.organization_id so service queries can be tenant-scoped directly.
-- ============================================================================

ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid;

ALTER TABLE public.value_maps
  ADD COLUMN IF NOT EXISTS organization_id uuid;

ALTER TABLE public.kpi_hypotheses
  ADD COLUMN IF NOT EXISTS organization_id uuid;

ALTER TABLE public.financial_models
  ADD COLUMN IF NOT EXISTS organization_id uuid;

ALTER TABLE public.assumptions
  ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Backfill strategy:
-- 1) Fill organization_id by joining through value_case_id.
-- 2) Keep statement idempotent so reruns only target still-null rows.
UPDATE public.company_profiles cp
SET organization_id = vc.organization_id
FROM public.value_cases vc
WHERE cp.organization_id IS NULL
  AND cp.value_case_id = vc.id;

UPDATE public.value_maps vm
SET organization_id = vc.organization_id
FROM public.value_cases vc
WHERE vm.organization_id IS NULL
  AND vm.value_case_id = vc.id;

UPDATE public.kpi_hypotheses kh
SET organization_id = vc.organization_id
FROM public.value_cases vc
WHERE kh.organization_id IS NULL
  AND kh.value_case_id = vc.id;

UPDATE public.financial_models fm
SET organization_id = vc.organization_id
FROM public.value_cases vc
WHERE fm.organization_id IS NULL
  AND fm.value_case_id = vc.id;

UPDATE public.assumptions a
SET organization_id = vc.organization_id
FROM public.value_cases vc
WHERE a.organization_id IS NULL
  AND a.value_case_id = vc.id;

CREATE INDEX IF NOT EXISTS idx_company_profiles_org_value_case
  ON public.company_profiles (organization_id, value_case_id);

CREATE INDEX IF NOT EXISTS idx_value_maps_org_value_case
  ON public.value_maps (organization_id, value_case_id);

CREATE INDEX IF NOT EXISTS idx_kpi_hypotheses_org_value_case
  ON public.kpi_hypotheses (organization_id, value_case_id);

CREATE INDEX IF NOT EXISTS idx_financial_models_org_value_case
  ON public.financial_models (organization_id, value_case_id);

CREATE INDEX IF NOT EXISTS idx_assumptions_org_value_case
  ON public.assumptions (organization_id, value_case_id);
