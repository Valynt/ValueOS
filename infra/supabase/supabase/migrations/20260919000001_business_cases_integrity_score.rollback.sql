-- Rollback: business_cases integrity_score column
-- Reverses 20260919000001_business_cases_integrity_score.sql

SET search_path = public, pg_temp;

ALTER TABLE public.business_cases
    DROP COLUMN IF EXISTS integrity_score;
