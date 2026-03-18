-- ============================================================================
-- Value Modeling Engine — Assumptions and Scenarios tables (Rollback)
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS public.sensitivity_analysis;
DROP TABLE IF EXISTS public.scenarios;
DROP TABLE IF EXISTS public.assumptions;

COMMIT;
