-- Rollback: Deal Assembly Pipeline tables

SET search_path = public, pg_temp;

-- Drop triggers first
DROP TRIGGER IF EXISTS update_deal_contexts_updated_at ON public.deal_contexts;
DROP TRIGGER IF EXISTS update_stakeholders_updated_at ON public.stakeholders;
DROP TRIGGER IF EXISTS update_use_cases_updated_at ON public.use_cases;

-- Drop RLS policies
DROP POLICY IF EXISTS deal_contexts_tenant_select ON public.deal_contexts;
DROP POLICY IF EXISTS deal_contexts_tenant_insert ON public.deal_contexts;
DROP POLICY IF EXISTS deal_contexts_tenant_update ON public.deal_contexts;
DROP POLICY IF EXISTS deal_contexts_tenant_delete ON public.deal_contexts;

DROP POLICY IF EXISTS deal_context_sources_tenant_select ON public.deal_context_sources;
DROP POLICY IF EXISTS deal_context_sources_tenant_insert ON public.deal_context_sources;
DROP POLICY IF EXISTS deal_context_sources_tenant_update ON public.deal_context_sources;
DROP POLICY IF EXISTS deal_context_sources_tenant_delete ON public.deal_context_sources;

DROP POLICY IF EXISTS stakeholders_tenant_select ON public.stakeholders;
DROP POLICY IF EXISTS stakeholders_tenant_insert ON public.stakeholders;
DROP POLICY IF EXISTS stakeholders_tenant_update ON public.stakeholders;
DROP POLICY IF EXISTS stakeholders_tenant_delete ON public.stakeholders;

DROP POLICY IF EXISTS use_cases_tenant_select ON public.use_cases;
DROP POLICY IF EXISTS use_cases_tenant_insert ON public.use_cases;
DROP POLICY IF EXISTS use_cases_tenant_update ON public.use_cases;
DROP POLICY IF EXISTS use_cases_tenant_delete ON public.use_cases;

-- Drop tables (cascade to handle FK constraints)
DROP TABLE IF EXISTS public.use_cases;
DROP TABLE IF EXISTS public.stakeholders;
DROP TABLE IF EXISTS public.deal_context_sources;
DROP TABLE IF EXISTS public.deal_contexts;
