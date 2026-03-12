-- Rollback: drop commitment tracking tables in reverse dependency order.

BEGIN;

DROP TABLE IF EXISTS public.commitment_audits;
DROP TABLE IF EXISTS public.commitment_notes;
DROP TABLE IF EXISTS public.commitment_risks;
DROP TABLE IF EXISTS public.commitment_metrics;
DROP TABLE IF EXISTS public.commitment_milestones;
DROP TABLE IF EXISTS public.commitment_stakeholders;
DROP TABLE IF EXISTS public.value_commitments;

COMMIT;
