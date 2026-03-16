-- Rollback: 20260304030000_create_usage_ledger
-- Drops the usage_ledger table.

BEGIN;

DROP TABLE IF EXISTS public.usage_ledger CASCADE;

COMMIT;
