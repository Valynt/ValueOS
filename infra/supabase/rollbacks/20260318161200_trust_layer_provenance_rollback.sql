-- Rollback: Trust Layer provenance tables
-- Removes provenance_records, case_readiness_scores, and plausibility_classifications tables

SET search_path = public, pg_temp;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS public.plausibility_classifications CASCADE;
DROP TABLE IF EXISTS public.case_readiness_scores CASCADE;
DROP TABLE IF EXISTS public.provenance_records CASCADE;
