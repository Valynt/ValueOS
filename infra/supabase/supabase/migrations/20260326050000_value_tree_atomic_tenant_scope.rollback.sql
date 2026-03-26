-- Rollback: 20260326050000_value_tree_atomic_tenant_scope

DROP FUNCTION IF EXISTS public.update_value_tree_atomic(uuid, jsonb, jsonb, integer, uuid, uuid);
