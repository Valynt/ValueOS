-- Rollback: 20260220000000_billing_v2_rated_ledger
-- Drops the rated_ledger table and its indexes.
DROP TABLE IF EXISTS public.rated_ledger CASCADE;
