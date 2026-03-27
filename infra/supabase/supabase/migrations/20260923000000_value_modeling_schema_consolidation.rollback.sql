-- Rollback: Value Modeling Schema Consolidation
--
-- Drops all tables created by 20260923000000_value_modeling_schema_consolidation.
-- WARNING: This is destructive. All value modeling data will be lost.
-- Only use in non-production environments or as part of a coordinated rollback plan.

BEGIN;

DROP TABLE IF EXISTS public.promise_handoff_notes CASCADE;
DROP TABLE IF EXISTS public.promise_checkpoints CASCADE;
DROP TABLE IF EXISTS public.promise_kpi_targets CASCADE;
DROP TABLE IF EXISTS public.promise_baselines CASCADE;
DROP TABLE IF EXISTS public.sensitivity_analysis CASCADE;
DROP TABLE IF EXISTS public.scenarios CASCADE;
DROP TABLE IF EXISTS public.assumptions CASCADE;
DROP TABLE IF EXISTS public.value_hypotheses CASCADE;

COMMIT;
