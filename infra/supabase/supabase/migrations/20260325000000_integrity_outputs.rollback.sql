-- Rollback: 20260325000000_integrity_outputs.sql
-- Drops the integrity_outputs table.

SET search_path = public, pg_temp;

DROP TABLE IF EXISTS public.integrity_outputs CASCADE;
