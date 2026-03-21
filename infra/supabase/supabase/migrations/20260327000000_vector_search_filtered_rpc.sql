-- Vector search filter helpers and typed RPC.
--
-- Moves reusable semantic_memory filter evaluation into Postgres so backend
-- services stop constructing SQL WHERE fragments in application code.

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.semantic_memory_compare_filter_value(
  p_candidate text,
  p_expected jsonb,
  p_operator text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  candidate_numeric double precision;
  expected_numeric double precision;
  expected_text text;
BEGIN
  IF p_candidate IS NULL OR p_expected IS NULL THEN
    RETURN FALSE;
  END IF;

  expected_text := p_expected #>> '{}';

  IF jsonb_typeof(p_expected) = 'number' THEN
    BEGIN
      candidate_numeric := p_candidate::double precision;
      expected_numeric := expected_text::double precision;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RETURN FALSE;
    END;

    CASE p_operator
      WHEN 'gt' THEN RETURN candidate_numeric > expected_numeric;
      WHEN 'gte' THEN RETURN candidate_numeric >= expected_numeric;
      WHEN 'lt' THEN RETURN candidate_numeric < expected_numeric;
      WHEN 'lte' THEN RETURN candidate_numeric <= expected_numeric;
      ELSE RETURN FALSE;
    END CASE;
  END IF;

  CASE p_operator
    WHEN 'gt' THEN RETURN p_candidate > expected_text;
    WHEN 'gte' THEN RETURN p_candidate >= expected_text;
    WHEN 'lt' THEN RETURN p_candidate < expected_text;
    WHEN 'lte' THEN RETURN p_candidate <= expected_text;
    ELSE RETURN FALSE;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.semantic_memory_metadata_matches_filters(
  p_metadata jsonb,
  p_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  filter_key text;
  filter_value jsonb;
  metadata_value jsonb;
  metadata_text text;
  actual_boolean boolean;
  expected_boolean boolean;
  actual_numeric double precision;
  expected_numeric double precision;
BEGIN
  IF p_filters IS NULL OR p_filters = '{}'::jsonb THEN
    RETURN TRUE;
  END IF;

  FOR filter_key, filter_value IN
    SELECT key, value
    FROM jsonb_each(p_filters)
  LOOP
    metadata_value := p_metadata -> filter_key;
    metadata_text := p_metadata ->> filter_key;

    IF metadata_value IS NULL THEN
      RETURN FALSE;
    END IF;

    CASE jsonb_typeof(filter_value)
      WHEN 'string' THEN
        IF metadata_text IS DISTINCT FROM filter_value #>> '{}' THEN
          RETURN FALSE;
        END IF;
      WHEN 'number' THEN
        BEGIN
          actual_numeric := metadata_text::double precision;
          expected_numeric := (filter_value #>> '{}')::double precision;
        EXCEPTION
          WHEN invalid_text_representation THEN
            RETURN FALSE;
        END;

        IF actual_numeric <> expected_numeric THEN
          RETURN FALSE;
        END IF;
      WHEN 'boolean' THEN
        BEGIN
          actual_boolean := metadata_text::boolean;
          expected_boolean := (filter_value #>> '{}')::boolean;
        EXCEPTION
          WHEN invalid_text_representation THEN
            RETURN FALSE;
        END;

        IF actual_boolean IS DISTINCT FROM expected_boolean THEN
          RETURN FALSE;
        END IF;
      WHEN 'array' THEN
        IF jsonb_typeof(metadata_value) <> 'array' OR NOT (metadata_value @> filter_value) THEN
          RETURN FALSE;
        END IF;
      WHEN 'object' THEN
        IF filter_value ? 'gt' THEN
          IF NOT public.semantic_memory_compare_filter_value(metadata_text, filter_value->'gt', 'gt') THEN
            RETURN FALSE;
          END IF;
        END IF;

        IF filter_value ? 'gte' THEN
          IF NOT public.semantic_memory_compare_filter_value(metadata_text, filter_value->'gte', 'gte') THEN
            RETURN FALSE;
          END IF;
        END IF;

        IF filter_value ? 'lt' THEN
          IF NOT public.semantic_memory_compare_filter_value(metadata_text, filter_value->'lt', 'lt') THEN
            RETURN FALSE;
          END IF;
        END IF;

        IF filter_value ? 'lte' THEN
          IF NOT public.semantic_memory_compare_filter_value(metadata_text, filter_value->'lte', 'lte') THEN
            RETURN FALSE;
          END IF;
        END IF;
      WHEN 'null' THEN
        IF metadata_value IS NOT NULL THEN
          RETURN FALSE;
        END IF;
      ELSE
        RETURN FALSE;
    END CASE;
  END LOOP;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_semantic_memory_filtered(
  query_embedding public.vector,
  match_threshold double precision DEFAULT 0.7,
  match_count integer DEFAULT 10,
  p_type text DEFAULT NULL,
  p_require_lineage boolean DEFAULT TRUE,
  p_metadata_filters jsonb DEFAULT '{}'::jsonb,
  p_organization_id uuid DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  type text,
  content text,
  embedding public.vector,
  metadata jsonb,
  created_at timestamptz,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sm.id,
    sm.type,
    sm.content,
    sm.embedding,
    sm.metadata,
    sm.created_at,
    1 - (sm.embedding <=> query_embedding) AS similarity
  FROM public.semantic_memory sm
  WHERE (p_type IS NULL OR sm.type = p_type)
    AND (
      p_organization_id IS NULL
      OR sm.organization_id = p_organization_id
      OR sm.tenant_id = p_organization_id
    )
    AND (
      p_tenant_id IS NULL
      OR sm.tenant_id = p_tenant_id
      OR sm.organization_id = p_tenant_id
    )
    AND (
      NOT p_require_lineage
      OR (
        sm.metadata ? 'source_origin'
        AND sm.metadata ? 'data_sensitivity_level'
        AND COALESCE(sm.metadata->>'source_origin', '') <> ''
        AND COALESCE(sm.metadata->>'data_sensitivity_level', '') <> ''
        AND LOWER(COALESCE(sm.metadata->>'source_origin', 'unknown')) <> 'unknown'
        AND LOWER(COALESCE(sm.metadata->>'data_sensitivity_level', 'unknown')) <> 'unknown'
      )
    )
    AND public.semantic_memory_metadata_matches_filters(
      COALESCE(sm.metadata, '{}'::jsonb),
      COALESCE(p_metadata_filters, '{}'::jsonb)
    )
    AND (
      match_threshold <= 0
      OR (1 - (sm.embedding <=> query_embedding)) >= match_threshold
    )
  ORDER BY sm.embedding <=> query_embedding
  LIMIT GREATEST(COALESCE(match_count, 10), 1);
$$;

GRANT EXECUTE ON FUNCTION public.semantic_memory_compare_filter_value(text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.semantic_memory_compare_filter_value(text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.semantic_memory_metadata_matches_filters(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.semantic_memory_metadata_matches_filters(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_semantic_memory_filtered(
  public.vector,
  double precision,
  integer,
  text,
  boolean,
  jsonb,
  uuid,
  uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_semantic_memory_filtered(
  public.vector,
  double precision,
  integer,
  text,
  boolean,
  jsonb,
  uuid,
  uuid
) TO service_role;
