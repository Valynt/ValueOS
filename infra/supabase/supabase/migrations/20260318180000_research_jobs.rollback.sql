-- Rollback for research_jobs migration
-- Removes company_research_jobs and company_research_suggestions tables

SET search_path = public, pg_temp;

-- Drop triggers first
DROP TRIGGER IF EXISTS update_company_research_jobs_updated_at ON public.company_research_jobs;

-- Drop tables (cascade removes indexes and RLS policies)
DROP TABLE IF EXISTS public.company_research_suggestions CASCADE;
DROP TABLE IF EXISTS public.company_research_jobs CASCADE;
