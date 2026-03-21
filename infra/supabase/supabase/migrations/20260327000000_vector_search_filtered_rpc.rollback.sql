-- Rollback vector-search filtered RPC helpers.

DROP FUNCTION IF EXISTS public.search_semantic_memory_filtered(
  public.vector,
  double precision,
  integer,
  text,
  boolean,
  jsonb,
  uuid,
  uuid
);
DROP FUNCTION IF EXISTS public.semantic_memory_metadata_matches_filters(jsonb, jsonb);
DROP FUNCTION IF EXISTS public.semantic_memory_compare_filter_value(text, jsonb, text);
