-- Ensure value tree writes validate tenant ownership server-side.

CREATE OR REPLACE FUNCTION public.update_value_tree_atomic(
  p_tree_id uuid,
  p_nodes jsonb,
  p_links jsonb,
  p_expected_version integer,
  p_user_id uuid,
  p_tenant_id uuid
)
RETURNS public.value_trees
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_updated public.value_trees;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'tenant_id is required';
  END IF;

  UPDATE public.value_trees
  SET
    nodes = COALESCE(p_nodes, nodes),
    links = COALESCE(p_links, links),
    version = version + 1,
    updated_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_tree_id
    AND tenant_id = p_tenant_id
    AND version = p_expected_version
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'value tree not found for tenant or version mismatch';
  END IF;

  RETURN v_updated;
END;
$$;
