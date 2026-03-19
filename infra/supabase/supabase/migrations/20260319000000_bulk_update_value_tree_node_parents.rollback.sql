-- Rollback: 20260319000000_bulk_update_value_tree_node_parents

BEGIN;

DROP FUNCTION IF EXISTS public.bulk_update_value_tree_node_parents(uuid, uuid, jsonb);

COMMIT;
