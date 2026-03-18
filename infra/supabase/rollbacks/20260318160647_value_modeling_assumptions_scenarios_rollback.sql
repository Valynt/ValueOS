-- Rollback: Value-Modeling Engine assumptions and scenarios tables

SET search_path = public, pg_temp;

-- Drop triggers first
DROP TRIGGER IF EXISTS update_assumptions_updated_at ON public.assumptions;

-- Drop function (safe to drop if not used elsewhere)
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Drop RLS policies
DROP POLICY IF EXISTS assumptions_tenant_select ON public.assumptions;
DROP POLICY IF EXISTS assumptions_tenant_insert ON public.assumptions;
DROP POLICY IF EXISTS assumptions_tenant_update ON public.assumptions;
DROP POLICY IF EXISTS assumptions_tenant_delete ON public.assumptions;

DROP POLICY IF EXISTS scenarios_tenant_select ON public.scenarios;
DROP POLICY IF EXISTS scenarios_tenant_insert ON public.scenarios;
DROP POLICY IF EXISTS scenarios_tenant_update ON public.scenarios;
DROP POLICY IF EXISTS scenarios_tenant_delete ON public.scenarios;

-- Drop tables (this also drops indexes and disables RLS)
DROP TABLE IF EXISTS public.assumptions;
DROP TABLE IF EXISTS public.scenarios;
