-- Rollback: 20260928000000_restore_llm_usage.sql

BEGIN;

DROP VIEW  IF EXISTS public.llm_usage_legacy_compat;
DROP TABLE IF EXISTS public.llm_usage;

COMMIT;
