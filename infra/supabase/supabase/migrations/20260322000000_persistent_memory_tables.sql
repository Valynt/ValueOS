-- Sprint 12: Persistent memory tables
-- Promotes semantic_memory from deferred to active schema.
-- Adds expansion_opportunities for durable ExpansionAgent output.
-- Adds vector search RPCs scoped by organization_id.

SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- Extensions (idempotent)
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- ---------------------------------------------------------------------------
-- 1. semantic_memory
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.semantic_memory (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL,
  type            text        NOT NULL,
  content         text        NOT NULL,
  embedding       vector(1536),
  metadata        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  source_agent    text        NOT NULL DEFAULT 'unknown',
  session_id      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT semantic_memory_pkey PRIMARY KEY (id),
  CONSTRAINT semantic_memory_type_check CHECK (
    type = ANY (ARRAY[
      'value_proposition',
      'target_definition',
      'opportunity',
      'integrity_check',
      'workflow_result',
      'narrative',
      'realization',
      'expansion_opportunity'
    ])
  )
);

ALTER TABLE public.semantic_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "semantic_memory_select" ON public.semantic_memory
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "semantic_memory_insert" ON public.semantic_memory
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "semantic_memory_update" ON public.semantic_memory
  FOR UPDATE USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "semantic_memory_delete" ON public.semantic_memory
  FOR DELETE USING (security.user_has_tenant_access(organization_id::text));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_semantic_memory_org_id
  ON public.semantic_memory (organization_id);

CREATE INDEX IF NOT EXISTS idx_semantic_memory_type
  ON public.semantic_memory (type);

CREATE INDEX IF NOT EXISTS idx_semantic_memory_created
  ON public.semantic_memory (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_semantic_memory_metadata_gin
  ON public.semantic_memory USING gin (metadata);

-- HNSW index for fast ANN cosine similarity search
CREATE INDEX IF NOT EXISTS idx_semantic_memory_embedding_hnsw
  ON public.semantic_memory USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ---------------------------------------------------------------------------
-- 2. expansion_opportunities
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.expansion_opportunities (
  id                          uuid        NOT NULL DEFAULT gen_random_uuid(),
  organization_id             uuid        NOT NULL,
  value_case_id               uuid        NOT NULL,
  session_id                  text,
  agent_run_id                text,

  -- Core fields from ExpansionOpportunitySchema
  title                       text        NOT NULL,
  description                 text        NOT NULL,
  type                        text        NOT NULL,
  source_kpi_id               text,
  estimated_value_low         numeric,
  estimated_value_high        numeric,
  estimated_value_unit        text,
  estimated_value_timeframe_months integer,
  confidence                  numeric,
  evidence                    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  prerequisites               jsonb       NOT NULL DEFAULT '[]'::jsonb,
  stakeholders                jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Batch-level fields (one row per opportunity, shared across a run)
  portfolio_summary           text,
  total_expansion_value_low   numeric,
  total_expansion_value_high  numeric,
  total_expansion_currency    text,
  gap_analysis                jsonb       NOT NULL DEFAULT '[]'::jsonb,
  new_cycle_recommendations   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  recommended_next_steps      jsonb       NOT NULL DEFAULT '[]'::jsonb,

  hallucination_check         boolean,
  source_agent                text        NOT NULL DEFAULT 'ExpansionAgent',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT expansion_opportunities_pkey PRIMARY KEY (id),
  CONSTRAINT expansion_opportunities_type_check CHECK (
    type = ANY (ARRAY[
      'upsell',
      'cross_sell',
      'new_use_case',
      'geographic_expansion',
      'deeper_adoption'
    ])
  )
);

ALTER TABLE public.expansion_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expansion_opportunities_select" ON public.expansion_opportunities
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "expansion_opportunities_insert" ON public.expansion_opportunities
  FOR INSERT WITH CHECK (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "expansion_opportunities_update" ON public.expansion_opportunities
  FOR UPDATE USING (security.user_has_tenant_access(organization_id::text));

CREATE POLICY "expansion_opportunities_delete" ON public.expansion_opportunities
  FOR DELETE USING (security.user_has_tenant_access(organization_id::text));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expansion_opportunities_org_id
  ON public.expansion_opportunities (organization_id);

CREATE INDEX IF NOT EXISTS idx_expansion_opportunities_case_id
  ON public.expansion_opportunities (value_case_id, organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_expansion_opportunities_type
  ON public.expansion_opportunities (type);

-- ---------------------------------------------------------------------------
-- 3. Vector search RPCs (tenant-scoped)
-- ---------------------------------------------------------------------------

-- match_semantic_memory: cosine similarity search scoped to one tenant
CREATE OR REPLACE FUNCTION public.match_semantic_memory(
  query_embedding   vector(1536),
  p_organization_id uuid,
  match_threshold   float    DEFAULT 0.7,
  match_count       integer  DEFAULT 10,
  p_type            text     DEFAULT NULL
)
RETURNS TABLE (
  id              uuid,
  type            text,
  content         text,
  metadata        jsonb,
  source_agent    text,
  session_id      text,
  similarity      float,
  created_at      timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sm.id,
    sm.type,
    sm.content,
    sm.metadata,
    sm.source_agent,
    sm.session_id,
    1 - (sm.embedding <=> query_embedding) AS similarity,
    sm.created_at
  FROM public.semantic_memory sm
  WHERE
    sm.organization_id = p_organization_id
    AND sm.embedding IS NOT NULL
    AND (p_type IS NULL OR sm.type = p_type)
    AND 1 - (sm.embedding <=> query_embedding) >= match_threshold
  ORDER BY sm.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_semantic_memory TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_semantic_memory TO service_role;

-- match_semantic_memory_hybrid: combines vector similarity + full-text search
CREATE OR REPLACE FUNCTION public.match_semantic_memory_hybrid(
  query_embedding   vector(1536),
  query_text        text,
  p_organization_id uuid,
  match_threshold   float    DEFAULT 0.6,
  match_count       integer  DEFAULT 10,
  p_type            text     DEFAULT NULL
)
RETURNS TABLE (
  id              uuid,
  type            text,
  content         text,
  metadata        jsonb,
  source_agent    text,
  session_id      text,
  similarity      float,
  created_at      timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sm.id,
    sm.type,
    sm.content,
    sm.metadata,
    sm.source_agent,
    sm.session_id,
    -- Blend: 70% vector similarity + 30% text rank (normalised to 0-1)
    (0.7 * (1 - (sm.embedding <=> query_embedding)))
      + (0.3 * ts_rank(to_tsvector('english', sm.content), plainto_tsquery('english', query_text)) / 10.0)
      AS similarity,
    sm.created_at
  FROM public.semantic_memory sm
  WHERE
    sm.organization_id = p_organization_id
    AND sm.embedding IS NOT NULL
    AND (p_type IS NULL OR sm.type = p_type)
    AND 1 - (sm.embedding <=> query_embedding) >= match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_semantic_memory_hybrid TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_semantic_memory_hybrid TO service_role;
