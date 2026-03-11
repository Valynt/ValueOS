-- Rollback: Sprint 12 persistent memory tables

DROP FUNCTION IF EXISTS public.match_semantic_memory_hybrid(vector(1536), text, uuid, float, integer, text);
DROP FUNCTION IF EXISTS public.match_semantic_memory(vector(1536), uuid, float, integer, text);
DROP TABLE IF EXISTS public.expansion_opportunities CASCADE;
DROP TABLE IF EXISTS public.semantic_memory CASCADE;
