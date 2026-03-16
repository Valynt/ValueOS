-- ============================================================================
-- Migration: value-case related tables organization scoping
--
-- Adds organization_id to post-v1 value-case child tables and backfills from
-- value_cases.organization_id so service queries can be tenant-scoped directly.
--
-- Guard: each statement is wrapped in a DO block that checks the target table
-- exists, so this migration is safe on databases where the archived monolith
-- tables (company_profiles, value_maps, kpi_hypotheses, financial_models,
-- assumptions) were never created.
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'company_profiles') THEN
    ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS organization_id uuid;
    UPDATE public.company_profiles cp SET organization_id = vc.organization_id
      FROM public.value_cases vc WHERE cp.organization_id IS NULL AND cp.value_case_id = vc.id;
    CREATE INDEX IF NOT EXISTS idx_company_profiles_org_value_case ON public.company_profiles (organization_id, value_case_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'value_maps') THEN
    ALTER TABLE public.value_maps ADD COLUMN IF NOT EXISTS organization_id uuid;
    UPDATE public.value_maps vm SET organization_id = vc.organization_id
      FROM public.value_cases vc WHERE vm.organization_id IS NULL AND vm.value_case_id = vc.id;
    CREATE INDEX IF NOT EXISTS idx_value_maps_org_value_case ON public.value_maps (organization_id, value_case_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kpi_hypotheses') THEN
    ALTER TABLE public.kpi_hypotheses ADD COLUMN IF NOT EXISTS organization_id uuid;
    UPDATE public.kpi_hypotheses kh SET organization_id = vc.organization_id
      FROM public.value_cases vc WHERE kh.organization_id IS NULL AND kh.value_case_id = vc.id;
    CREATE INDEX IF NOT EXISTS idx_kpi_hypotheses_org_value_case ON public.kpi_hypotheses (organization_id, value_case_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_models') THEN
    ALTER TABLE public.financial_models ADD COLUMN IF NOT EXISTS organization_id uuid;
    UPDATE public.financial_models fm SET organization_id = vc.organization_id
      FROM public.value_cases vc WHERE fm.organization_id IS NULL AND fm.value_case_id = vc.id;
    CREATE INDEX IF NOT EXISTS idx_financial_models_org_value_case ON public.financial_models (organization_id, value_case_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assumptions') THEN
    ALTER TABLE public.assumptions ADD COLUMN IF NOT EXISTS organization_id uuid;
    UPDATE public.assumptions a SET organization_id = vc.organization_id
      FROM public.value_cases vc WHERE a.organization_id IS NULL AND a.value_case_id = vc.id;
    CREATE INDEX IF NOT EXISTS idx_assumptions_org_value_case ON public.assumptions (organization_id, value_case_id);
  END IF;
END $$;
