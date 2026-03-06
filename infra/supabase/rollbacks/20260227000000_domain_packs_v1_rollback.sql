-- Rollback: 20260227000000_domain_packs_v1
-- Drops domain pack tables, associated columns on value_cases, and the helper function.
DROP TABLE IF EXISTS public.domain_pack_assumptions CASCADE;
DROP TABLE IF EXISTS public.domain_pack_kpis CASCADE;
DROP TABLE IF EXISTS public.domain_packs CASCADE;
ALTER TABLE public.value_cases
  DROP COLUMN IF EXISTS domain_pack_id,
  DROP COLUMN IF EXISTS domain_pack_version;
DROP FUNCTION IF EXISTS public.current_tenant_id();
