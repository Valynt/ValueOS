-- Rollback: 20260322000000_persistent_memory_tables.sql
-- Drops semantic_memory and expansion_opportunities tables.

SET search_path = public, pg_temp;

DROP TABLE IF EXISTS public.expansion_opportunities CASCADE;
DROP TABLE IF EXISTS public.semantic_memory CASCADE;
