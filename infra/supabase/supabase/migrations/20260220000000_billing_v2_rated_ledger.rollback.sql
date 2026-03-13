-- Rollback: 20260220000000_billing_v2_rated_ledger.sql
-- Drops the rated_ledger table.

SET search_path = public, pg_temp;

DROP TABLE IF EXISTS public.rated_ledger CASCADE;
