-- ============================================================================
-- 005_research_jobs.sql — Memory-first architecture tables
-- B2B deal-centric knowledge OS: artifacts, entities, facts, benchmarks,
-- model runs, narratives, and approvals. Multi-tenancy via RLS + pgvector.
-- ============================================================================

-- ============================================================================
-- 1. Core identity
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.memory_tenants (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.memory_profiles (
    id uuid PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.memory_tenants(id),
    full_name text,
    role text CHECK (role IN ('admin', 'editor', 'viewer', 'guest')),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- 2. Knowledge input layer
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.memory_value_cases (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES public.memory_tenants(id),
    title text NOT NULL,
    description text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'won', 'lost')),
    fts tsvector GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || coalesce(description, ''))) STORED,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.memory_artifacts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES public.memory_tenants(id),
    value_case_id uuid REFERENCES public.memory_value_cases(id) ON DELETE SET NULL,
    source_url text,
    title text NOT NULL,
    content_type text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.memory_artifact_chunks (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES public.memory_tenants(id),
    artifact_id uuid NOT NULL REFERENCES public.memory_artifacts(id) ON DELETE CASCADE,
    content text NOT NULL,
    embedding vector(1536),
    chunk_index int NOT NULL,
    fts tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    metadata jsonb DEFAULT '{}'::jsonb
);

-- ============================================================================
-- 3. Semantic layer (knowledge graph)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.memory_entities (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES public.memory_tenants(id),
    name text NOT NULL,
    entity_type text NOT NULL,
    description text,
    embedding vector(1536),
    fts tsvector GENERATED ALWAYS AS (to_tsvector('english', name || ' ' || coalesce(description, ''))) STORED,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT unique_tenant_entity_name UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.memory_entity_edges (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES public.memory_tenants(id),
    source_id uuid NOT NULL REFERENCES public.memory_entities(id) ON DELETE CASCADE,
    target_id uuid NOT NULL REFERENCES public.memory_entities(id) ON DELETE CASCADE,
    relationship_type text NOT NULL,
    weight float DEFAULT 1.0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- 4. Facts (curated truths with versioning)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.memory_facts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES public.memory_tenants(id),
    claim text NOT NULL,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'deprecated')),
    version int DEFAULT 1 NOT NULL,
    embedding vector(1536),
    fts tsvector GENERATED ALWAYS AS (to_tsvector('english', claim)) STORED,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid REFERENCES public.memory_profiles(id)
);

CREATE TABLE IF NOT EXISTS public.memory_fact_evidence (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES public.memory_tenants(id),
    fact_id uuid NOT NULL REFERENCES public.memory_facts(id) ON DELETE CASCADE,
    chunk_id uuid REFERENCES public.memory_artifact_chunks(id),
    quote text,
    confidence_score float,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- 5. Evaluation and benchmarking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.memory_benchmark_datasets (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES public.memory_tenants(id),
    name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.memory_benchmark_versions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id uuid NOT NULL REFERENCES public.memory_benchmark_datasets(id) ON DELETE CASCADE,
    tenant_id uuid,
    version_tag text NOT NULL,
    is_active boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.memory_benchmark_slices (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id uuid REFERENCES public.memory_benchmark_slices(id),
    version int NOT NULL DEFAULT 1,
    name text NOT NULL,
    industry varchar(100),
    geo varchar(50),
    company_size_range varchar(50),
    tier smallint DEFAULT 3,
    metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
    checksum text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.memory_benchmark_run_locks (
    id varchar(50) PRIMARY KEY,
    slice_id uuid REFERENCES public.memory_benchmark_slices(id),
    run_id uuid NOT NULL,
    provenance_hash text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- 6. Model runs (tracking agentic actions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.memory_model_runs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES public.memory_tenants(id),
    value_case_id uuid REFERENCES public.memory_value_cases(id),
    model_name text NOT NULL,
    engine_version text,
    run_hash text,
    input_prompt text,
    output_response text,
    inputs jsonb DEFAULT '{}'::jsonb,
    results jsonb DEFAULT '{}'::jsonb,
    benchmarks jsonb DEFAULT '[]'::jsonb,
    tokens_used int,
    latency_ms int,
    status text DEFAULT 'success',
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.memory_model_run_evidence (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_run_id uuid NOT NULL REFERENCES public.memory_model_runs(id) ON DELETE CASCADE,
    tenant_id uuid,
    fact_id uuid REFERENCES public.memory_facts(id),
    relevance_score float
);

-- ============================================================================
-- 7. Narratives and approvals
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.memory_narratives (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES public.memory_tenants(id),
    value_case_id uuid REFERENCES public.memory_value_cases(id),
    title text NOT NULL,
    body text NOT NULL,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'final', 'deprecated')),
    version int DEFAULT 1 NOT NULL,
    fts tsvector GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || body)) STORED,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.memory_approvals (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES public.memory_tenants(id),
    resource_type text NOT NULL,
    resource_id uuid NOT NULL,
    approver_id uuid REFERENCES public.memory_profiles(id),
    decision text CHECK (decision IN ('approved', 'rejected')),
    comments text,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- 8. Guest access grants
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.memory_access_grants (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES public.memory_tenants(id),
    resource_type text NOT NULL,
    resource_id uuid NOT NULL,
    grantee_email text,
    token_hash text UNIQUE,
    tier text DEFAULT 'read_only' CHECK (tier IN ('read_only', 'commenter', 'full_access')),
    expires_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================================
-- 9. Vector indexes (HNSW for cosine similarity)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_memory_artifact_chunks_embedding ON public.memory_artifact_chunks
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_memory_entities_embedding ON public.memory_entities
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_memory_facts_embedding ON public.memory_facts
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- 10. Full-text search indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_memory_value_cases_fts ON public.memory_value_cases USING gin(fts);
CREATE INDEX IF NOT EXISTS idx_memory_artifact_chunks_fts ON public.memory_artifact_chunks USING gin(fts);
CREATE INDEX IF NOT EXISTS idx_memory_entities_fts ON public.memory_entities USING gin(fts);
CREATE INDEX IF NOT EXISTS idx_memory_facts_fts ON public.memory_facts USING gin(fts);
CREATE INDEX IF NOT EXISTS idx_memory_narratives_fts ON public.memory_narratives USING gin(fts);

-- ============================================================================
-- 11. Additional performance indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_memory_artifacts_tenant ON public.memory_artifacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memory_artifact_chunks_artifact ON public.memory_artifact_chunks(artifact_id);
CREATE INDEX IF NOT EXISTS idx_memory_facts_tenant_status ON public.memory_facts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_memory_model_runs_tenant ON public.memory_model_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memory_benchmark_slices_active ON public.memory_benchmark_slices(is_active);

-- ============================================================================
-- 12. RLS: Enable on all memory tables
-- ============================================================================

ALTER TABLE public.memory_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_value_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_artifact_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_entity_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_fact_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_benchmark_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_benchmark_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_model_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_model_run_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_narratives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_access_grants ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies for memory tables with tenant_id
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'memory_value_cases', 'memory_artifacts', 'memory_artifact_chunks',
    'memory_entities', 'memory_entity_edges', 'memory_facts',
    'memory_fact_evidence', 'memory_benchmark_datasets',
    'memory_model_runs', 'memory_narratives', 'memory_approvals',
    'memory_access_grants', 'memory_profiles'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_select ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_insert ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_update ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_delete ON public.%I;', tbl);

    EXECUTE format(
      'CREATE POLICY tenant_isolation_select ON public.%I AS RESTRICTIVE FOR SELECT USING (security.user_has_tenant_access(tenant_id));', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_insert ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (security.user_has_tenant_access(tenant_id));', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_update ON public.%I AS RESTRICTIVE FOR UPDATE USING (security.user_has_tenant_access(tenant_id)) WITH CHECK (security.user_has_tenant_access(tenant_id));', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_delete ON public.%I AS RESTRICTIVE FOR DELETE USING (security.user_has_tenant_access(tenant_id));', tbl);
  END LOOP;
END $$;

-- memory_tenants: id-based (no tenant_id column)
DROP POLICY IF EXISTS memory_tenants_select ON public.memory_tenants;
DROP POLICY IF EXISTS memory_tenants_insert ON public.memory_tenants;
DROP POLICY IF EXISTS memory_tenants_update ON public.memory_tenants;
DROP POLICY IF EXISTS memory_tenants_delete ON public.memory_tenants;

CREATE POLICY memory_tenants_select ON public.memory_tenants
  FOR SELECT USING (id = security.current_tenant_id_uuid());
CREATE POLICY memory_tenants_insert ON public.memory_tenants
  FOR INSERT WITH CHECK (id = security.current_tenant_id_uuid());
CREATE POLICY memory_tenants_update ON public.memory_tenants
  FOR UPDATE USING (id = security.current_tenant_id_uuid())
  WITH CHECK (id = security.current_tenant_id_uuid());
CREATE POLICY memory_tenants_delete ON public.memory_tenants
  FOR DELETE USING (id = security.current_tenant_id_uuid());

-- ============================================================================
-- 13. Search functions
-- ============================================================================

-- Hybrid search: combines vector similarity with full-text search
CREATE OR REPLACE FUNCTION public.memory_hybrid_search(
    p_tenant_id uuid,
    query_embedding vector(1536),
    query_text text DEFAULT '',
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    p_value_case_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        ac.id,
        ac.content,
        ac.metadata,
        1 - (ac.embedding <=> query_embedding) AS similarity
    FROM public.memory_artifact_chunks ac
    INNER JOIN public.memory_artifacts a ON ac.artifact_id = a.id
    WHERE ac.tenant_id = p_tenant_id
      AND (p_value_case_id IS NULL OR a.value_case_id = p_value_case_id)
      AND 1 - (ac.embedding <=> query_embedding) > match_threshold
    ORDER BY ac.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- Security barrier view for scoped access
CREATE OR REPLACE VIEW security.memory_value_cases_scoped
WITH (security_barrier = true)
AS
  SELECT *
  FROM public.memory_value_cases
  WHERE tenant_id = security.current_tenant_id_uuid();
