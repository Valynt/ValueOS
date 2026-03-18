-- Rollback: Deal Assembly Pipeline Tables
-- Task: 2.7
-- Purpose: Rollback migration 20260318000000_deal_assembly_pipeline

-- Drop triggers
DROP TRIGGER IF EXISTS update_use_cases_updated_at ON public.use_cases;
DROP TRIGGER IF EXISTS update_stakeholders_updated_at ON public.stakeholders;
DROP TRIGGER IF EXISTS update_deal_contexts_updated_at ON public.deal_contexts;

-- Drop RLS policies
DROP POLICY IF EXISTS deal_contexts_tenant_access ON public.deal_contexts;
DROP POLICY IF EXISTS deal_context_sources_tenant_access ON public.deal_context_sources;
DROP POLICY IF EXISTS stakeholders_tenant_access ON public.stakeholders;
DROP POLICY IF EXISTS use_cases_tenant_access ON public.use_cases;

-- Drop tables (cascade will handle foreign key constraints)
DROP TABLE IF EXISTS public.use_cases CASCADE;
DROP TABLE IF EXISTS public.stakeholders CASCADE;
DROP TABLE IF EXISTS public.deal_context_sources CASCADE;
DROP TABLE IF EXISTS public.deal_contexts CASCADE;

-- Drop function
DROP FUNCTION IF EXISTS public.update_updated_at_column();
