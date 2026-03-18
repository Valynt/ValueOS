-- ============================================================================
-- Promise Baseline Handoff — Baselines, KPI Targets, and Checkpoints (Rollback)
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS public.promise_handoff_notes;
DROP TABLE IF EXISTS public.promise_checkpoints;
DROP TABLE IF EXISTS public.promise_kpi_targets;
DROP TABLE IF EXISTS public.promise_baselines;

COMMIT;
