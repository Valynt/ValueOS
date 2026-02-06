-- ValueOS Memory-First Architecture Migration
-- Description: Production-ready SQL schema for a B2B deal-centric knowledge OS.
-- Features: Multi-tenancy via RLS, pgvector HNSW indexing, Hybrid Search, and Governance.

-- ==========================================
-- 1. EXTENSIONS & INITIAL SETUP
-- ==========================================

create extension if not exists "vector" with schema "public";
create extension if not exists "uuid-ossp" with schema "public";
create extension if not exists "fuzzystrmatch" with schema "public";

-- Create a schema-specific search path security helper
create or replace function public.get_tenant_id()
returns uuid language sql stable as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;

-- ==========================================
-- 2. CORE IDENTITY & ISOLATION
-- ==========================================

-- Tenants (Companies/Accounts)
create table if not exists public.memory_tenants (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    slug text unique not null,
    settings jsonb default '{}'::jsonb,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- Profiles (Extends Supabase Auth)
create table if not exists public.memory_profiles (
    id uuid primary key references auth.users on delete cascade,
    tenant_id uuid not null references public.memory_tenants(id),
    full_name text,
    role text check (role in ('admin', 'editor', 'viewer', 'guest')),
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- ==========================================
-- 3. THE KNOWLEDGE INPUT LAYER
-- ==========================================

-- Value Cases (High-level business initiatives or deals)
create table if not exists public.memory_value_cases (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.memory_tenants(id),
    title text not null,
    description text,
    status text default 'active' check (status in ('active', 'archived', 'won', 'lost')),
    fts tsvector generated always as (to_tsvector('english', title || ' ' || coalesce(description, ''))) stored,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- Artifacts (Documents, Emails, Transcripts)
create table if not exists public.memory_artifacts (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.memory_tenants(id),
    value_case_id uuid references public.memory_value_cases(id) on delete set null,
    source_url text,
    title text not null,
    content_type text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now() not null
);

-- Artifact Chunks (Vectorized segments)
create table if not exists public.memory_artifact_chunks (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.memory_tenants(id),
    artifact_id uuid not null references public.memory_artifacts(id) on delete cascade,
    content text not null,
    embedding vector(1536),
    chunk_index int not null,
    fts tsvector generated always as (to_tsvector('english', content)) stored,
    metadata jsonb default '{}'::jsonb
);

-- ==========================================
-- 4. SEMANTIC LAYER (KNOWLEDGE GRAPH)
-- ==========================================

-- Entities (Extracted people, companies, technologies)
create table if not exists public.memory_entities (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.memory_tenants(id),
    name text not null,
    entity_type text not null,
    description text,
    embedding vector(1536),
    fts tsvector generated always as (to_tsvector('english', name || ' ' || coalesce(description, ''))) stored,
    created_at timestamptz default now() not null,
    constraint unique_tenant_entity_name unique (tenant_id, name)
);

-- Entity Edges (Relationships in the Graph)
create table if not exists public.memory_entity_edges (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.memory_tenants(id),
    source_id uuid not null references public.memory_entities(id) on delete cascade,
    target_id uuid not null references public.memory_entities(id) on delete cascade,
    relationship_type text not null,
    weight float default 1.0,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz default now() not null
);

-- ==========================================
-- 5. HIGH-FIDELITY KNOWLEDGE (FACTS)
-- ==========================================

-- Facts (Curated Truths with Versioning)
create table if not exists public.memory_facts (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.memory_tenants(id),
    claim text not null,
    status text default 'draft' check (status in ('draft', 'approved', 'deprecated')),
    version int default 1 not null,
    embedding vector(1536),
    fts tsvector generated always as (to_tsvector('english', claim)) stored,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    created_by uuid references public.memory_profiles(id)
);

-- Fact Evidence (Provenance/Lineage)
create table if not exists public.memory_fact_evidence (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.memory_tenants(id),
    fact_id uuid not null references public.memory_facts(id) on delete cascade,
    chunk_id uuid references public.memory_artifact_chunks(id),
    quote text,
    confidence_score float,
    created_at timestamptz default now() not null
);

-- ==========================================
-- 6. EVALUATION & BENCHMARKING
-- ==========================================

create table if not exists public.memory_benchmark_datasets (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.memory_tenants(id),
    name text not null,
    description text,
    created_at timestamptz default now() not null
);

create table if not exists public.memory_benchmark_versions (
    id uuid primary key default uuid_generate_v4(),
    dataset_id uuid not null references public.memory_benchmark_datasets(id) on delete cascade,
    version_tag text not null,
    is_active boolean default false,
    created_at timestamptz default now() not null
);

create table if not exists public.memory_benchmark_slices (
    id uuid primary key default uuid_generate_v4(),
    parent_id uuid references public.memory_benchmark_slices(id),
    version int not null default 1,
    name text not null,
    industry varchar(100),
    geo varchar(50),
    company_size_range varchar(50),
    tier smallint default 3,
    metrics jsonb not null default '{}'::jsonb,
    checksum text not null,
    is_active boolean default true,
    created_at timestamptz default now() not null
);

create table if not exists public.memory_benchmark_run_locks (
    id varchar(50) primary key,
    slice_id uuid references public.memory_benchmark_slices(id),
    run_id uuid not null,
    provenance_hash text not null,
    created_at timestamptz default now() not null
);

-- Model Runs (Tracking Agentic Actions)
create table if not exists public.memory_model_runs (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.memory_tenants(id),
    value_case_id uuid references public.memory_value_cases(id),
    model_name text not null,
    engine_version text,
    run_hash text,
    input_prompt text,
    output_response text,
    inputs jsonb default '{}'::jsonb,
    results jsonb default '{}'::jsonb,
    benchmarks jsonb default '[]'::jsonb,
    tokens_used int,
    latency_ms int,
    status text default 'success',
    created_at timestamptz default now() not null
);

create table if not exists public.memory_model_run_evidence (
    id uuid primary key default uuid_generate_v4(),
    model_run_id uuid not null references public.memory_model_runs(id) on delete cascade,
    fact_id uuid references public.memory_facts(id),
    relevance_score float
);

-- ==========================================
-- 7. NARRATIVES & APPROVALS
-- ==========================================

-- Narratives (AI Generated reports/outbound content)
create table if not exists public.memory_narratives (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.memory_tenants(id),
    value_case_id uuid references public.memory_value_cases(id),
    title text not null,
    body text not null,
    status text default 'draft' check (status in ('draft', 'review', 'final', 'deprecated')),
    version int default 1 not null,
    fts tsvector generated always as (to_tsvector('english', title || ' ' || body)) stored,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null
);

-- Approvals (Audit Trail)
create table if not exists public.memory_approvals (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.memory_tenants(id),
    resource_type text not null,
    resource_id uuid not null,
    approver_id uuid references public.memory_profiles(id),
    decision text check (decision in ('approved', 'rejected')),
    comments text,
    created_at timestamptz default now() not null
);

-- ==========================================
-- 8. SECURITY & GUEST ACCESS
-- ==========================================

-- Access Grants (For Guest Links or External Collab)
create table if not exists public.memory_access_grants (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid not null references public.memory_tenants(id),
    resource_type text not null,
    resource_id uuid not null,
    grantee_email text,
    token_hash text unique,
    tier text default 'read_only' check (tier in ('read_only', 'commenter', 'full_access')),
    expires_at timestamptz,
    created_at timestamptz default now() not null
);

-- ==========================================
-- 9. PERFORMANCE INDEXING
-- ==========================================

-- HNSW Vector Indexes (Optimized for Cosine Similarity)
create index if not exists idx_memory_artifact_chunks_embedding on public.memory_artifact_chunks
using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);

create index if not exists idx_memory_entities_embedding on public.memory_entities
using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);

create index if not exists idx_memory_facts_embedding on public.memory_facts
using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);

-- GIN Full Text Search Indexes
create index if not exists idx_memory_value_cases_fts on public.memory_value_cases using gin(fts);
create index if not exists idx_memory_artifact_chunks_fts on public.memory_artifact_chunks using gin(fts);
create index if not exists idx_memory_entities_fts on public.memory_entities using gin(fts);
create index if not exists idx_memory_facts_fts on public.memory_facts using gin(fts);
create index if not exists idx_memory_narratives_fts on public.memory_narratives using gin(fts);

-- Additional Performance Indexes
create index if not exists idx_memory_artifacts_tenant on public.memory_artifacts(tenant_id);
create index if not exists idx_memory_artifact_chunks_artifact on public.memory_artifact_chunks(artifact_id);
create index if not exists idx_memory_facts_tenant_status on public.memory_facts(tenant_id, status);
create index if not exists idx_memory_model_runs_tenant on public.memory_model_runs(tenant_id);
create index if not exists idx_memory_benchmark_slices_active on public.memory_benchmark_slices(is_active);

-- ==========================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all memory tables
alter table public.memory_tenants enable row level security;
alter table public.memory_profiles enable row level security;
alter table public.memory_value_cases enable row level security;
alter table public.memory_artifacts enable row level security;
alter table public.memory_artifact_chunks enable row level security;
alter table public.memory_entities enable row level security;
alter table public.memory_entity_edges enable row level security;
alter table public.memory_facts enable row level security;
alter table public.memory_fact_evidence enable row level security;
alter table public.memory_benchmark_datasets enable row level security;
alter table public.memory_benchmark_versions enable row level security;
alter table public.memory_model_runs enable row level security;
alter table public.memory_model_run_evidence enable row level security;
alter table public.memory_narratives enable row level security;
alter table public.memory_approvals enable row level security;
alter table public.memory_access_grants enable row level security;

-- Tenant Access Policies (canonical user_tenants access)
create policy "memory_value_cases_select" on public.memory_value_cases
for select using (security.user_has_tenant_access(tenant_id));
create policy "memory_value_cases_insert" on public.memory_value_cases
for insert with check (security.user_has_tenant_access(tenant_id));
create policy "memory_value_cases_update" on public.memory_value_cases
for update using (security.user_has_tenant_access(tenant_id))
with check (security.user_has_tenant_access(tenant_id));
create policy "memory_value_cases_delete" on public.memory_value_cases
for delete using (security.user_has_tenant_access(tenant_id));

create policy "memory_artifacts_select" on public.memory_artifacts
for select using (security.user_has_tenant_access(tenant_id));
create policy "memory_artifacts_insert" on public.memory_artifacts
for insert with check (security.user_has_tenant_access(tenant_id));
create policy "memory_artifacts_update" on public.memory_artifacts
for update using (security.user_has_tenant_access(tenant_id))
with check (security.user_has_tenant_access(tenant_id));
create policy "memory_artifacts_delete" on public.memory_artifacts
for delete using (security.user_has_tenant_access(tenant_id));

create policy "memory_artifact_chunks_select" on public.memory_artifact_chunks
for select using (security.user_has_tenant_access(tenant_id));
create policy "memory_artifact_chunks_insert" on public.memory_artifact_chunks
for insert with check (security.user_has_tenant_access(tenant_id));
create policy "memory_artifact_chunks_update" on public.memory_artifact_chunks
for update using (security.user_has_tenant_access(tenant_id))
with check (security.user_has_tenant_access(tenant_id));
create policy "memory_artifact_chunks_delete" on public.memory_artifact_chunks
for delete using (security.user_has_tenant_access(tenant_id));

create policy "memory_entities_select" on public.memory_entities
for select using (security.user_has_tenant_access(tenant_id));
create policy "memory_entities_insert" on public.memory_entities
for insert with check (security.user_has_tenant_access(tenant_id));
create policy "memory_entities_update" on public.memory_entities
for update using (security.user_has_tenant_access(tenant_id))
with check (security.user_has_tenant_access(tenant_id));
create policy "memory_entities_delete" on public.memory_entities
for delete using (security.user_has_tenant_access(tenant_id));

create policy "memory_entity_edges_select" on public.memory_entity_edges
for select using (security.user_has_tenant_access(tenant_id));
create policy "memory_entity_edges_insert" on public.memory_entity_edges
for insert with check (security.user_has_tenant_access(tenant_id));
create policy "memory_entity_edges_update" on public.memory_entity_edges
for update using (security.user_has_tenant_access(tenant_id))
with check (security.user_has_tenant_access(tenant_id));
create policy "memory_entity_edges_delete" on public.memory_entity_edges
for delete using (security.user_has_tenant_access(tenant_id));

create policy "memory_facts_select" on public.memory_facts
for select using (security.user_has_tenant_access(tenant_id));
create policy "memory_facts_insert" on public.memory_facts
for insert with check (security.user_has_tenant_access(tenant_id));
create policy "memory_facts_update" on public.memory_facts
for update using (security.user_has_tenant_access(tenant_id))
with check (security.user_has_tenant_access(tenant_id));
create policy "memory_facts_delete" on public.memory_facts
for delete using (security.user_has_tenant_access(tenant_id));

create policy "memory_fact_evidence_select" on public.memory_fact_evidence
for select using (security.user_has_tenant_access(tenant_id));
create policy "memory_fact_evidence_insert" on public.memory_fact_evidence
for insert with check (security.user_has_tenant_access(tenant_id));
create policy "memory_fact_evidence_update" on public.memory_fact_evidence
for update using (security.user_has_tenant_access(tenant_id))
with check (security.user_has_tenant_access(tenant_id));
create policy "memory_fact_evidence_delete" on public.memory_fact_evidence
for delete using (security.user_has_tenant_access(tenant_id));

create policy "memory_benchmark_datasets_select" on public.memory_benchmark_datasets
for select using (security.user_has_tenant_access(tenant_id));
create policy "memory_benchmark_datasets_insert" on public.memory_benchmark_datasets
for insert with check (security.user_has_tenant_access(tenant_id));
create policy "memory_benchmark_datasets_update" on public.memory_benchmark_datasets
for update using (security.user_has_tenant_access(tenant_id))
with check (security.user_has_tenant_access(tenant_id));
create policy "memory_benchmark_datasets_delete" on public.memory_benchmark_datasets
for delete using (security.user_has_tenant_access(tenant_id));

create policy "memory_model_runs_select" on public.memory_model_runs
for select using (security.user_has_tenant_access(tenant_id));
create policy "memory_model_runs_insert" on public.memory_model_runs
for insert with check (security.user_has_tenant_access(tenant_id));
create policy "memory_model_runs_update" on public.memory_model_runs
for update using (security.user_has_tenant_access(tenant_id))
with check (security.user_has_tenant_access(tenant_id));
create policy "memory_model_runs_delete" on public.memory_model_runs
for delete using (security.user_has_tenant_access(tenant_id));

create policy "memory_narratives_select" on public.memory_narratives
for select using (security.user_has_tenant_access(tenant_id));
create policy "memory_narratives_insert" on public.memory_narratives
for insert with check (security.user_has_tenant_access(tenant_id));
create policy "memory_narratives_update" on public.memory_narratives
for update using (security.user_has_tenant_access(tenant_id))
with check (security.user_has_tenant_access(tenant_id));
create policy "memory_narratives_delete" on public.memory_narratives
for delete using (security.user_has_tenant_access(tenant_id));

create policy "memory_approvals_select" on public.memory_approvals
for select using (security.user_has_tenant_access(tenant_id));
create policy "memory_approvals_insert" on public.memory_approvals
for insert with check (security.user_has_tenant_access(tenant_id));
create policy "memory_approvals_update" on public.memory_approvals
for update using (security.user_has_tenant_access(tenant_id))
with check (security.user_has_tenant_access(tenant_id));
create policy "memory_approvals_delete" on public.memory_approvals
for delete using (security.user_has_tenant_access(tenant_id));

create policy "memory_access_grants_select" on public.memory_access_grants
for select using (security.user_has_tenant_access(tenant_id));
create policy "memory_access_grants_insert" on public.memory_access_grants
for insert with check (security.user_has_tenant_access(tenant_id));
create policy "memory_access_grants_update" on public.memory_access_grants
for update using (security.user_has_tenant_access(tenant_id))
with check (security.user_has_tenant_access(tenant_id));
create policy "memory_access_grants_delete" on public.memory_access_grants
for delete using (security.user_has_tenant_access(tenant_id));

-- Profile Access Policy
create policy "memory_profiles_access" on public.memory_profiles
for select using (security.user_has_tenant_access(tenant_id));

-- Tenant Visibility Policy
create policy "memory_tenants_visibility" on public.memory_tenants
for select using (security.user_has_tenant_access(id));

-- ==========================================
-- 11. HYBRID SEARCH UTILITY FUNCTION
-- ==========================================

create or replace function public.memory_hybrid_search_chunks(
    p_tenant_id uuid,
    query_text text,
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    full_text_weight float default 1.0,
    semantic_weight float default 1.0
)
returns table (
    id uuid,
    content text,
    metadata jsonb,
    similarity float,
    fts_rank float,
    combined_score float
)
language sql stable as $$
    with semantic_results as (
        select ac.id, 1 - (ac.embedding <=> query_embedding) as similarity
        from public.memory_artifact_chunks ac
        where ac.tenant_id = p_tenant_id
        order by ac.embedding <=> query_embedding
        limit match_count * 2
    ),
    fts_results as (
        select ac.id, ts_rank_cd(ac.fts, plainto_tsquery('english', query_text)) as fts_rank
        from public.memory_artifact_chunks ac
        where ac.tenant_id = p_tenant_id and ac.fts @@ plainto_tsquery('english', query_text)
        limit match_count * 2
    )
    select
        c.id,
        c.content,
        c.metadata,
        coalesce(s.similarity, 0)::float as similarity,
        coalesce(f.fts_rank, 0)::float as fts_rank,
        (coalesce(s.similarity, 0) * semantic_weight + coalesce(f.fts_rank, 0) * full_text_weight) as combined_score
    from public.memory_artifact_chunks c
    left join semantic_results s on c.id = s.id
    left join fts_results f on c.id = f.id
    where c.tenant_id = p_tenant_id
    and (s.similarity > match_threshold or f.fts_rank > 0)
    order by combined_score desc
    limit match_count;
$$;

-- Match chunks for vector search (used by RetrievalEngine)
create or replace function public.memory_match_chunks(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    p_tenant_id uuid,
    p_value_case_id uuid default null
)
returns table (
    id uuid,
    content text,
    metadata jsonb,
    similarity float
)
language sql stable as $$
    select
        ac.id,
        ac.content,
        ac.metadata,
        1 - (ac.embedding <=> query_embedding) as similarity
    from public.memory_artifact_chunks ac
    inner join public.memory_artifacts a on ac.artifact_id = a.id
    where ac.tenant_id = p_tenant_id
    and (p_value_case_id is null or a.value_case_id = p_value_case_id)
    and 1 - (ac.embedding <=> query_embedding) > match_threshold
    order by ac.embedding <=> query_embedding
    limit match_count;
$$;
