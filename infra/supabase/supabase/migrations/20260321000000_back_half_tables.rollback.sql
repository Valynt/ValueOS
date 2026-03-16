-- Rollback: 20260321000000_back_half_tables
-- Drops integrity_results, narrative_drafts, and realization_reports.

BEGIN;

DROP TABLE IF EXISTS public.realization_reports CASCADE;
DROP TABLE IF EXISTS public.narrative_drafts CASCADE;
DROP TABLE IF EXISTS public.integrity_results CASCADE;

COMMIT;
