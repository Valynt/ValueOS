-- Rollback: 20260401000000_partition_high_volume_tables.sql
--
-- Converts partitioned tables back to plain tables.
-- Data in partition children is preserved via the parent detach + rename approach.

SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS public.create_next_monthly_partitions();

-- value_loop_events
CREATE TABLE public.value_loop_events_plain (LIKE public.value_loop_events INCLUDING ALL);
INSERT INTO public.value_loop_events_plain SELECT * FROM public.value_loop_events;
DROP TABLE public.value_loop_events CASCADE;
ALTER TABLE public.value_loop_events_plain RENAME TO value_loop_events;
ALTER TABLE public.value_loop_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY vle_tenant_select ON public.value_loop_events
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));
CREATE POLICY vle_tenant_insert ON public.value_loop_events
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id::text));
GRANT SELECT, INSERT ON public.value_loop_events TO authenticated;
GRANT ALL ON public.value_loop_events TO service_role;

-- saga_transitions
CREATE TABLE public.saga_transitions_plain (LIKE public.saga_transitions INCLUDING ALL);
INSERT INTO public.saga_transitions_plain SELECT * FROM public.saga_transitions;
DROP TABLE public.saga_transitions CASCADE;
ALTER TABLE public.saga_transitions_plain RENAME TO saga_transitions;
ALTER TABLE public.saga_transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY saga_transitions_select ON public.saga_transitions
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));
CREATE POLICY saga_transitions_insert ON public.saga_transitions
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id::text));
GRANT SELECT, INSERT ON public.saga_transitions TO authenticated;
GRANT ALL ON public.saga_transitions TO service_role;

-- rated_ledger
CREATE TABLE public.rated_ledger_plain (LIKE public.rated_ledger INCLUDING ALL);
INSERT INTO public.rated_ledger_plain SELECT * FROM public.rated_ledger;
DROP TABLE public.rated_ledger CASCADE;
ALTER TABLE public.rated_ledger_plain RENAME TO rated_ledger;
ALTER TABLE public.rated_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY rated_ledger_tenant_select ON public.rated_ledger
  FOR SELECT USING (security.user_has_tenant_access(tenant_id::text));
CREATE POLICY rated_ledger_service_role ON public.rated_ledger
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON public.rated_ledger TO authenticated;
GRANT ALL ON public.rated_ledger TO service_role;

-- usage_ledger
CREATE TABLE public.usage_ledger_plain (LIKE public.usage_ledger INCLUDING ALL);
INSERT INTO public.usage_ledger_plain SELECT * FROM public.usage_ledger;
DROP TABLE public.usage_ledger CASCADE;
ALTER TABLE public.usage_ledger_plain RENAME TO usage_ledger;
ALTER TABLE public.usage_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_ledger_tenant_isolation ON public.usage_ledger
  FOR ALL TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
GRANT ALL ON public.usage_ledger TO service_role;
GRANT SELECT, INSERT ON public.usage_ledger TO authenticated;
