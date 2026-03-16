-- Rollback: 20260326000000_semantic_memory_stats_rpc
-- Drops the get_semantic_memory_stats RPC function.

BEGIN;

DROP FUNCTION IF EXISTS public.get_semantic_memory_stats(uuid);

COMMIT;
