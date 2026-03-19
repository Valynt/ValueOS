SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.bulk_update_value_tree_node_parents(
  p_case_id uuid,
  p_organization_id uuid,
  p_parent_links jsonb
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_count integer := 0;
BEGIN
  IF p_parent_links IS NULL OR jsonb_typeof(p_parent_links) <> 'array' OR jsonb_array_length(p_parent_links) = 0 THEN
    RETURN 0;
  END IF;

  WITH parent_links AS (
    SELECT
      link.node_id,
      link.parent_id
    FROM jsonb_to_recordset(p_parent_links) AS link(node_id uuid, parent_id uuid)
  ),
  updated_rows AS (
    UPDATE public.value_tree_nodes AS child
    SET parent_id = parent_links.parent_id,
        updated_at = now()
    FROM parent_links
    JOIN public.value_tree_nodes AS parent
      ON parent.id = parent_links.parent_id
     AND parent.case_id = p_case_id
     AND parent.organization_id = p_organization_id
    WHERE child.id = parent_links.node_id
      AND child.case_id = p_case_id
      AND child.organization_id = p_organization_id
    RETURNING child.id
  )
  SELECT COUNT(*)::integer
  INTO v_updated_count
  FROM updated_rows;

  RETURN v_updated_count;
END;
$$;
