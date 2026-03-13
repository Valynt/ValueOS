-- Rollback: 20260227000000_domain_packs_v1.sql
-- Drops domain pack tables and removes domain_pack columns from value_cases.

SET search_path = public, pg_temp;

ALTER TABLE public.value_cases
  DROP COLUMN IF EXISTS domain_pack_snapshot,
  DROP COLUMN IF EXISTS domain_pack_version,
  DROP COLUMN IF EXISTS domain_pack_id;

DROP TABLE IF EXISTS public.domain_pack_assumptions CASCADE;
DROP TABLE IF EXISTS public.domain_pack_kpis CASCADE;
DROP TABLE IF EXISTS public.domain_packs CASCADE;
